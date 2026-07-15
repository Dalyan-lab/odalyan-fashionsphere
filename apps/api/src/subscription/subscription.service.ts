import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, SubscriptionPlan } from '@prisma/client';
import {
  PERIOD_DAYS,
  PLAN_AI_CREDITS,
  planPrice,
  type BillingPeriod,
  type SubscribeInput,
  type SubscriptionStatusDto,
} from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CouponsService } from '../coupon/coupons.service';
import { MailService } from '../mail/mail.service';
import { PaystackProvider, PaystackUnreachableError } from '../payment/providers/paystack.provider';

/** Fenêtre de rappel avant expiration (jours). */
const REMINDER_DAYS = 3;

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackProvider,
    private readonly coupons: CouponsService,
    private readonly mail: MailService,
  ) {}

  /** Statut d'abonnement de la boutique du vendeur (rétrograde à la volée si expiré). */
  async me(userId: string): Promise<SubscriptionStatusDto> {
    const shop = await this.prisma.shop.findUnique({
      where: { ownerId: userId },
      include: { subscription: true },
    });
    if (!shop) throw new ForbiddenException('Vous devez d’abord créer une boutique.');
    let sub = shop.subscription;

    // Blocage strict : un plan payant expiré redescend immédiatement en STARTER
    if (sub && sub.plan !== SubscriptionPlan.STARTER && sub.expiresAt && sub.expiresAt.getTime() < Date.now()) {
      await this.downgradeToStarter(sub.id, shop.id);
      sub = await this.prisma.subscription.findUnique({ where: { id: sub.id } });
    }

    const plan = sub?.plan ?? SubscriptionPlan.STARTER;
    const expired = Boolean(sub?.expiresAt && sub.expiresAt.getTime() < Date.now());
    return {
      plan,
      active: sub?.active ?? true,
      startedAt: sub?.startedAt?.toISOString() ?? null,
      expiresAt: sub?.expiresAt?.toISOString() ?? null,
      expired,
    };
  }

  /** Aperçu d'un code promo sur un plan/période (avant paiement). */
  async previewCoupon(userId: string, code: string, plan: SubscriptionPlan, period: BillingPeriod) {
    const shop = await this.prisma.shop.findUnique({ where: { ownerId: userId }, select: { id: true } });
    if (!shop) throw new ForbiddenException('Vous devez d’abord créer une boutique.');
    return this.coupons.preview(code, shop.id, planPrice(plan, period), 'subscription');
  }

  /**
   * Démarre le passage à un plan payant : crée un lien Paystack pour la période.
   * Plan STARTER = gratuit → bascule immédiate (rétrogradation). Sans Paystack (dev)
   * ou plan gratuit → activation directe.
   */
  async checkout(userId: string, input: SubscribeInput): Promise<{ link: string | null; activated: boolean }> {
    const shop = await this.prisma.shop.findUnique({
      where: { ownerId: userId },
      include: { owner: { select: { email: true } } },
    });
    if (!shop) throw new ForbiddenException('Vous devez d’abord créer une boutique.');

    const period = input.period as BillingPeriod;

    // Plan gratuit : bascule immédiate, aucun paiement
    if (input.plan === SubscriptionPlan.STARTER) {
      await this.activate(shop.id, SubscriptionPlan.STARTER, null);
      return { link: null, activated: true };
    }

    const basePrice = planPrice(input.plan, period);
    if (basePrice <= 0) throw new BadRequestException('Plan invalide.');

    // Code promo éventuel
    let amountEur = basePrice;
    let discountEur = 0;
    let appliedCode: string | undefined;
    if (input.couponCode?.trim()) {
      const res = await this.coupons.check(input.couponCode, shop.id, 'subscription');
      if ('reason' in res) throw new BadRequestException(res.reason);
      discountEur = CouponsService.discountFor(res.coupon, basePrice);
      amountEur = Math.max(0, Math.round((basePrice - discountEur) * 100) / 100);
      appliedCode = res.coupon.code;
    }

    const reference = `ODLSUB-${shop.id.slice(-6)}-${Date.now()}`;

    // Sans Paystack (dev) : activation immédiate
    if (!this.paystack.enabled) {
      await this.recordPayment(shop.id, input.plan, period, amountEur, 'EUR', 'mock', reference, 'PAID', appliedCode, discountEur);
      await this.activate(shop.id, input.plan, period);
      if (appliedCode) await this.coupons.redeem(appliedCode, shop.id, `subscription:${input.plan}`, discountEur);
      return { link: null, activated: true };
    }

    try {
      const ps = await this.paystack.createGenericLink({
        reference,
        amountEur,
        email: shop.owner.email,
        kind: 'subscription',
        metadata: { shopId: shop.id, plan: input.plan, period, couponCode: appliedCode ?? '' },
      });
      await this.recordPayment(shop.id, input.plan, period, amountEur, ps.currency, 'paystack', ps.txRef, 'PENDING', appliedCode, discountEur);
      return { link: ps.link, activated: false };
    } catch (err) {
      const unreachable = err instanceof PaystackUnreachableError;
      this.logger.error(`Abonnement — paiement échoué : ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        unreachable
          ? 'Service de paiement momentanément injoignable. Réessayez dans un instant.'
          : 'Le paiement a été refusé par Paystack.',
      );
    }
  }

  /** Vérifie un paiement d'abonnement (retour Paystack) et active le plan (idempotent). */
  async verify(
    reference: string,
    successful: boolean,
  ): Promise<{ status: string; kind: 'subscription'; plan?: SubscriptionPlan }> {
    const payment = await this.prisma.subscriptionPayment.findUnique({ where: { providerRef: reference } });
    if (!payment) return { status: 'FAILED', kind: 'subscription' };
    if (!successful) return { status: 'FAILED', kind: 'subscription' };

    if (payment.status !== 'PAID') {
      await this.prisma.subscriptionPayment.update({ where: { id: payment.id }, data: { status: 'PAID' } });
      await this.activate(payment.shopId, payment.plan, payment.period as BillingPeriod);
      if (payment.couponCode) {
        await this.coupons.redeem(
          payment.couponCode,
          payment.shopId,
          `subscription:${payment.plan}`,
          payment.discountEur ? Number(payment.discountEur) : 0,
        );
      }
    }
    return { status: 'PAID', kind: 'subscription', plan: payment.plan };
  }

  // --------------------------------------------------------------- Rappels (cron)

  /**
   * Rappel d'expiration : chaque jour à 09h00 UTC, prévient par email les vendeurs
   * dont le plan payant expire dans ≤ REMINDER_DAYS jours (ou vient d'expirer) et
   * qui n'ont pas encore été relancés pour ce cycle. reminderSentAt dédoublonne ;
   * il est remis à null au renouvellement (activate).
   */
  /** Tâches quotidiennes : rappels d'expiration puis blocage des plans expirés. */
  @Cron('0 9 * * *')
  async runDailyJobs(): Promise<void> {
    await this.sendExpiryReminders();
    const d = await this.downgradeExpired();
    if (d.downgraded) this.logger.log(`Blocage expiration : ${d.downgraded} plan(s) rétrogradé(s) en STARTER`);
  }

  async sendExpiryReminders(): Promise<{ processed: number }> {
    if (!this.mail.enabled) return { processed: 0 };
    const now = new Date();
    const horizon = new Date(now.getTime() + REMINDER_DAYS * 86_400_000);

    const subs = await this.prisma.subscription.findMany({
      where: {
        plan: { not: SubscriptionPlan.STARTER },
        expiresAt: { not: null, lte: horizon }, // expire bientôt ou déjà expiré
        reminderSentAt: null,
      },
      include: { shop: { include: { owner: { select: { email: true } } } } },
    });
    if (subs.length === 0) return { processed: 0 };

    const webOrigin = process.env.WEB_ORIGIN?.split(',')[0] ?? 'https://odalyan-fashionsphere.vercel.app';
    this.logger.log(`Rappels d'expiration : ${subs.length} abonnement(s) à relancer`);

    let processed = 0;
    for (const sub of subs) {
      const email = sub.shop.owner.email;
      if (!email || !sub.expiresAt) continue;
      const daysLeft = Math.ceil((sub.expiresAt.getTime() - now.getTime()) / 86_400_000);
      const sent = await this.mail.sendSubscriptionExpiring(email, {
        plan: sub.plan,
        expiresOn: sub.expiresAt.toLocaleDateString('fr-FR'),
        daysLeft,
        renewUrl: `${webOrigin}/dashboard/subscriptions`,
      });
      if (sent) {
        await this.prisma.subscription.update({ where: { id: sub.id }, data: { reminderSentAt: now } });
        processed++;
      }
    }
    return { processed };
  }

  /** Rétrograde tous les plans payants expirés vers STARTER (appelé par le cron). */
  async downgradeExpired(): Promise<{ downgraded: number }> {
    const now = new Date();
    const expired = await this.prisma.subscription.findMany({
      where: { plan: { not: SubscriptionPlan.STARTER }, expiresAt: { not: null, lt: now } },
      select: { id: true, shopId: true },
    });
    for (const s of expired) await this.downgradeToStarter(s.id, s.shopId);
    return { downgraded: expired.length };
  }

  /** Repasse une boutique en STARTER et recharge ses crédits au niveau STARTER. */
  private async downgradeToStarter(subId: string, shopId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id: subId },
        data: { plan: SubscriptionPlan.STARTER, active: true, expiresAt: null, reminderSentAt: null },
      }),
      // creditsRenewedAt=null → au prochain accès, getBalance recrédite au quota STARTER
      this.prisma.shop.update({ where: { id: shopId }, data: { creditsRenewedAt: null } }),
    ]);
  }

  // ------------------------------------------------------------------ internes

  /** Active/prolonge le plan et recharge les crédits au niveau du plan. */
  private async activate(shopId: string, plan: SubscriptionPlan, period: BillingPeriod | null): Promise<void> {
    const now = new Date();
    const expiresAt = period ? new Date(now.getTime() + PERIOD_DAYS[period] * 86_400_000) : null;

    await this.prisma.$transaction([
      this.prisma.subscription.upsert({
        where: { shopId },
        create: { shopId, plan, active: true, startedAt: now, expiresAt },
        // reminderSentAt remis à null : le rappel pourra repartir au prochain cycle
        update: { plan, active: true, startedAt: now, expiresAt, reminderSentAt: null },
      }),
      // Recharge immédiate des crédits mensuels au niveau du nouveau plan
      this.prisma.shop.update({
        where: { id: shopId },
        data: { aiCredits: PLAN_AI_CREDITS[plan] ?? 0, creditsRenewedAt: now },
      }),
    ]);
  }

  private recordPayment(
    shopId: string,
    plan: SubscriptionPlan,
    period: BillingPeriod,
    amount: number,
    currency: string,
    provider: string,
    providerRef: string,
    status: string,
    couponCode?: string,
    discountEur?: number,
  ) {
    return this.prisma.subscriptionPayment.create({
      data: {
        shopId,
        plan,
        period,
        amount: new Prisma.Decimal(amount),
        currency,
        provider,
        providerRef,
        status,
        couponCode: couponCode ?? null,
        discountEur: couponCode ? new Prisma.Decimal(discountEur ?? 0) : null,
      },
    });
  }
}
