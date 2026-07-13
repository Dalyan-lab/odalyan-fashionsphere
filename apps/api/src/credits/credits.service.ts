import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, SubscriptionPlan } from '@prisma/client';
import { CREDIT_PACKS, PLAN_AI_CREDITS, getCreditPack } from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaystackProvider,
  PaystackUnreachableError,
} from '../payment/providers/paystack.provider';

export interface CreditBalance {
  credits: number; // total utilisable (mensuel + acheté)
  monthly: number; // part du quota mensuel restante
  extra: number; // crédits achetés (report)
  plan: SubscriptionPlan;
  monthlyAllowance: number;
  renewedAt: Date | null;
}

/**
 * Gère les crédits IA par boutique :
 *  - un quota mensuel selon le plan (renouvellement « paresseux », sans cron) ;
 *  - des crédits achetés en supplément (recharge Paystack), reportés indéfiniment.
 * La consommation puise d'abord dans le quota mensuel, puis dans les crédits achetés.
 */
@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackProvider,
  ) {}

  private isSameMonth(a: Date, b: Date): boolean {
    return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
  }

  /** Renvoie le solde à jour (renouvelle le quota mensuel si un nouveau mois a commencé). */
  async getBalance(userId: string): Promise<CreditBalance> {
    const shop = await this.prisma.shop.findUnique({
      where: { ownerId: userId },
      include: { subscription: true },
    });
    if (!shop) throw new ForbiddenException('Vous devez d’abord créer une boutique.');

    const plan = shop.subscription?.plan ?? SubscriptionPlan.STARTER;
    const allowance = PLAN_AI_CREDITS[plan] ?? PLAN_AI_CREDITS[SubscriptionPlan.STARTER];
    const now = new Date();

    let monthly = shop.aiCredits;
    let renewedAt = shop.creditsRenewedAt;

    // Renouvellement mensuel du quota (les crédits achetés ne sont PAS touchés)
    if (!shop.creditsRenewedAt || !this.isSameMonth(shop.creditsRenewedAt, now)) {
      const updated = await this.prisma.shop.update({
        where: { id: shop.id },
        data: { aiCredits: allowance, creditsRenewedAt: now },
      });
      monthly = updated.aiCredits;
      renewedAt = now;
    }

    const extra = shop.aiCreditsExtra;
    return { credits: monthly + extra, monthly, extra, plan, monthlyAllowance: allowance, renewedAt };
  }

  /** Vérifie que le solde couvre `amount` (403 sinon), SANS débiter. À appeler avant une génération payante. */
  async ensure(userId: string, amount: number): Promise<void> {
    if (amount <= 0) return;
    const balance = await this.getBalance(userId);
    if (balance.credits < amount) throw this.depletedError(balance);
  }

  /** Débite `amount` crédits (mensuel d'abord, puis achetés), ou lève une 403 si insuffisant. */
  async consume(userId: string, amount: number): Promise<number> {
    if (amount <= 0) return (await this.getBalance(userId)).credits;
    const balance = await this.getBalance(userId);
    if (balance.credits < amount) throw this.depletedError(balance);

    const fromMonthly = Math.min(balance.monthly, amount);
    const fromExtra = amount - fromMonthly;
    const shop = await this.prisma.shop.update({
      where: { ownerId: userId },
      data: {
        aiCredits: { decrement: fromMonthly },
        ...(fromExtra > 0 ? { aiCreditsExtra: { decrement: fromExtra } } : {}),
      },
    });
    return shop.aiCredits + shop.aiCreditsExtra;
  }

  private depletedError(balance: CreditBalance): ForbiddenException {
    return new ForbiddenException(
      `Crédits IA épuisés (${balance.credits}/${balance.monthlyAllowance} — plan ${balance.plan}). ` +
        `Rechargez vos crédits ou passez à une offre supérieure pour continuer à générer.`,
    );
  }

  // ------------------------------------------------------------- Recharge (Phase 3)

  /** Packs de recharge disponibles + statut du moyen de paiement. */
  listPacks() {
    return { packs: CREDIT_PACKS, provider: this.paystack.enabled ? 'paystack' : 'mock' };
  }

  /**
   * Démarre l'achat d'un pack de crédits : crée un lien de paiement Paystack.
   * En l'absence de Paystack (dev), crédite immédiatement (mode simulé).
   */
  async purchase(userId: string, packId: string): Promise<{ link: string | null; reference: string }> {
    const pack = getCreditPack(packId);
    if (!pack) throw new BadRequestException('Pack de crédits inconnu.');

    const shop = await this.prisma.shop.findUnique({
      where: { ownerId: userId },
      include: { owner: { select: { email: true } } },
    });
    if (!shop) throw new ForbiddenException('Vous devez d’abord créer une boutique.');

    const reference = `ODLCR-${shop.id.slice(-6)}-${Date.now()}`;

    // Mode simulé : pas de Paystack → on crédite tout de suite (dev/local)
    if (!this.paystack.enabled) {
      await this.prisma.$transaction([
        this.prisma.creditPurchase.create({
          data: {
            shopId: shop.id,
            packId: pack.id,
            credits: pack.credits,
            amount: new Prisma.Decimal(pack.priceEur),
            currency: 'EUR',
            provider: 'mock',
            providerRef: reference,
            status: 'PAID',
          },
        }),
        this.prisma.shop.update({
          where: { id: shop.id },
          data: { aiCreditsExtra: { increment: pack.credits } },
        }),
      ]);
      return { link: null, reference };
    }

    try {
      const ps = await this.paystack.createGenericLink({
        reference,
        amountEur: pack.priceEur,
        email: shop.owner.email,
        kind: 'credits',
        metadata: { shopId: shop.id, packId: pack.id, credits: pack.credits },
      });
      await this.prisma.creditPurchase.create({
        data: {
          shopId: shop.id,
          packId: pack.id,
          credits: pack.credits,
          amount: new Prisma.Decimal(pack.priceEur),
          currency: ps.currency,
          provider: 'paystack',
          providerRef: ps.txRef,
          status: 'PENDING',
        },
      });
      return { link: ps.link, reference: ps.txRef };
    } catch (err) {
      const unreachable = err instanceof PaystackUnreachableError;
      this.logger.error(`Recharge crédits échouée : ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        unreachable
          ? 'Service de paiement momentanément injoignable. Réessayez dans un instant.'
          : 'La recharge a été refusée par Paystack.',
      );
    }
  }

  /**
   * Vérifie une recharge après retour de Paystack et crédite la boutique (idempotent).
   * Appelé par PaymentService quand la référence ne correspond pas à une commande.
   */
  async verifyPurchase(
    reference: string,
    successful: boolean,
  ): Promise<{ status: string; kind: 'credits'; credits?: number }> {
    const purchase = await this.prisma.creditPurchase.findUnique({ where: { providerRef: reference } });
    if (!purchase) return { status: 'FAILED', kind: 'credits' };
    if (!successful) return { status: 'FAILED', kind: 'credits' };

    // Idempotence : ne créditer qu'à la première confirmation
    if (purchase.status !== 'PAID') {
      await this.prisma.$transaction([
        this.prisma.creditPurchase.update({ where: { id: purchase.id }, data: { status: 'PAID' } }),
        this.prisma.shop.update({
          where: { id: purchase.shopId },
          data: { aiCreditsExtra: { increment: purchase.credits } },
        }),
      ]);
    }
    return { status: 'PAID', kind: 'credits', credits: purchase.credits };
  }
}
