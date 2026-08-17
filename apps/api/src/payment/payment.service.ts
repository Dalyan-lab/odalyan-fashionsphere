import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { PaymentProvider } from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { PayoutService } from '../payout/payout.service';
import { CreditsService } from '../credits/credits.service';
import { SubscriptionService } from '../subscription/subscription.service';
import {
  PaystackProvider,
  PaystackUnreachableError,
} from './providers/paystack.provider';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly stripe: Stripe | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackProvider,
    private readonly mail: MailService,
    private readonly credits: CreditsService,
    private readonly subscriptions: SubscriptionService,
    private readonly payouts: PayoutService,
  ) {
    const key = process.env.STRIPE_SECRET_KEY;
    this.stripe = key ? new Stripe(key) : null;
    if (!this.stripe && !this.paystack.enabled) {
      this.logger.warn('Aucun fournisseur de paiement configuré — mode simulé (mock) activé.');
    }
  }

  /** Quel fournisseur est actif (pour le frontend). */
  config() {
    return {
      provider: this.paystack.enabled ? 'paystack' : this.stripe ? 'stripe' : 'mock',
    };
  }

  /**
   * Crée l'enregistrement de paiement.
   * Priorité : Paystack > Stripe > simulé.
   */
  async createPaymentForGroup(groupId: string, amount: Prisma.Decimal, currency: string) {
    // ----- Paystack (carte + Mobile Money Wave/Orange/MTN/Moov, XOF) -----
    if (this.paystack.enabled) {
      const group = await this.prisma.orderGroup.findUnique({
        where: { id: groupId },
        include: { customer: true, orders: { take: 1, select: { shippingAddress: true } } },
      });
      const addr = (group!.orders[0]?.shippingAddress ?? {}) as Record<string, unknown>;
      try {
        const ps = await this.paystack.createLink({
          refId: groupId,
          refNumber: group!.reference,
          amount: Number(amount),
          email: group!.customer.email,
          name: `${group!.customer.firstName} ${group!.customer.lastName}`,
          phone: typeof addr.phone === 'string' ? addr.phone : undefined,
        });
        return await this.prisma.payment.create({
          data: {
            orderGroupId: groupId,
            provider: PaymentProvider.PAYSTACK,
            providerRef: ps.txRef,
            amount,
            currency,
            paid: false,
            rawPayload: {
              link: ps.link,
              txRef: ps.txRef,
              chargedAmount: ps.amount,
              chargedCurrency: ps.currency,
            } as Prisma.InputJsonValue,
          },
        });
      } catch (err) {
        // En dev, si Paystack est injoignable (réseau filtré), on bascule en mode
        // simulé pour permettre de tester le flux complet. En prod, on remonte l'erreur.
        const unreachable = err instanceof PaystackUnreachableError;
        if (unreachable && process.env.NODE_ENV !== 'production') {
          this.logger.warn(
            'Paystack injoignable en dev — repli sur paiement simulé pour cette commande.',
          );
          return this.createMockPayment(groupId, amount, currency);
        }
        this.logger.error(`Échec du paiement Paystack : ${(err as Error).message}`);
        throw new ServiceUnavailableException(
          unreachable
            ? 'Service de paiement momentanément injoignable. Réessayez dans un instant.'
            : 'Le paiement a été refusé par Paystack. Vérifiez les informations de la commande.',
        );
      }
    }

    if (this.stripe) {
      const intent = await this.stripe.paymentIntents.create({
        amount: Math.round(Number(amount) * 100),
        currency: currency.toLowerCase(),
        metadata: { groupId },
        automatic_payment_methods: { enabled: true },
      });

      return this.prisma.payment.create({
        data: {
          orderGroupId: groupId,
          provider: PaymentProvider.STRIPE,
          providerRef: intent.id,
          amount,
          currency,
          rawPayload: { clientSecret: intent.client_secret } as Prisma.InputJsonValue,
        },
      });
    }

    // Mode mock — paiement marqué payé immédiatement (dev uniquement)
    return this.createMockPayment(groupId, amount, currency);
  }

  /** Paiement simulé : marqué payé immédiatement et commande passée en PAID (dev). */
  private async createMockPayment(groupId: string, amount: Prisma.Decimal, currency: string) {
    const payment = await this.prisma.payment.create({
      data: {
        orderGroupId: groupId,
        provider: PaymentProvider.STRIPE,
        providerRef: `mock_${groupId}`,
        amount,
        currency,
        paid: true,
        rawPayload: { mock: true } as Prisma.InputJsonValue,
      },
    });
    await this.markGroupPaid(groupId);
    return payment;
  }

  /**
   * Passe toutes les commandes d'un panier en payées, puis traite chacune.
   *
   * Le paiement est unique mais les suites ne le sont pas : chaque vendeur a
   * sa commande à préparer, sa répartition à figer et son email à recevoir.
   */
  private async markGroupPaid(groupId: string): Promise<void> {
    const orders = await this.prisma.order.findMany({
      where: { groupId },
      select: { id: true },
    });
    await this.prisma.order.updateMany({
      where: { groupId },
      data: { status: 'PAID' },
    });
    for (const o of orders) void this.settleOrderPaid(o.id);
  }

  /**
   * Emails transactionnels après paiement réussi : confirmation au client +
   * notification au vendeur. Ne bloque jamais le flux de paiement (erreurs logguées).
   */
  /**
   * Suites d'un encaissement : figer la répartition, puis prévenir.
   *
   * La répartition passe avant et hors de l'envoi d'emails — `notifyOrderPaid`
   * sort tôt quand la messagerie n'est pas configurée, et une plateforme sans
   * email ne doit pas pour autant perdre la trace de ce qu'elle doit au vendeur.
   */
  private async settleOrderPaid(orderId: string): Promise<void> {
    await this.payouts.recordOrderSplit(orderId);
    await this.notifyOrderPaid(orderId);
  }

  private async notifyOrderPaid(orderId: string): Promise<void> {
    if (!this.mail.enabled) return;
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: { select: { email: true, firstName: true, lastName: true } },
          shop: { include: { owner: { select: { email: true } } } },
          items: { select: { productName: true, quantity: true } },
        },
      });
      if (!order) return;

      const items = order.items.map((i) => ({ name: i.productName, quantity: i.quantity }));
      const total = `${Number(order.totalAmount).toFixed(2)} ${order.currency}`;
      const customerName = `${order.customer.firstName} ${order.customer.lastName}`;

      await Promise.allSettled([
        this.mail.sendOrderConfirmation(order.customer.email, {
          orderNumber: order.orderNumber,
          total,
          items,
        }),
        this.mail.sendNewOrderNotification(order.shop.owner.email, {
          orderNumber: order.orderNumber,
          total,
          customerName,
          items,
        }),
      ]);
    } catch (err) {
      this.logger.error(`Emails de commande non envoyés (${orderId}) : ${String(err)}`);
    }
  }

  /** Traite un webhook Stripe (signature vérifiée). */
  async handleStripeWebhook(rawBody: Buffer, signature: string) {
    if (!this.stripe) return { received: true, mock: true };

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const groupId = intent.metadata?.groupId;
      // `orderId` : intentions créées avant le panier multi-boutiques, qui
      // peuvent encore aboutir.
      const legacyOrderId = intent.metadata?.orderId;

      if (groupId) {
        await this.prisma.payment.updateMany({
          where: { orderGroupId: groupId },
          data: { paid: true, rawPayload: intent as unknown as Prisma.InputJsonValue },
        });
        await this.markGroupPaid(groupId);
      } else if (legacyOrderId) {
        await this.prisma.payment.updateMany({
          where: { orderId: legacyOrderId },
          data: { paid: true, rawPayload: intent as unknown as Prisma.InputJsonValue },
        });
        await this.prisma.order.update({ where: { id: legacyOrderId }, data: { status: 'PAID' } });
        void this.settleOrderPaid(legacyOrderId);
      }
    }

    return { received: true };
  }

  /** Vérifie une transaction Paystack (reference = notre txRef) et marque payé si success. */
  async verifyPaystack(reference: string) {
    if (!this.paystack.enabled) return { status: 'MOCK' };
    const v = await this.paystack.verify(reference);
    const payment = await this.prisma.payment.findFirst({ where: { providerRef: reference } });

    // Référence sans commande associée : recharge de crédits ou abonnement
    if (!payment) {
      const credit = await this.prisma.creditPurchase.findUnique({ where: { providerRef: reference } });
      if (credit) return this.credits.verifyPurchase(reference, v.successful);
      return this.subscriptions.verify(reference, v.successful);
    }

    if (v.successful) {
      // Idempotence : n'envoie les emails qu'à la première confirmation
      const firstConfirmation = !payment.paid;
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { paid: true, rawPayload: { reference, verified: true } as Prisma.InputJsonValue },
      });
      if (payment.orderGroupId) {
        if (firstConfirmation) await this.markGroupPaid(payment.orderGroupId);
        return { status: 'PAID', groupId: payment.orderGroupId };
      }
      // Paiement antérieur au panier multi-boutiques : une seule commande.
      await this.prisma.order.update({ where: { id: payment.orderId! }, data: { status: 'PAID' } });
      if (firstConfirmation) void this.settleOrderPaid(payment.orderId!);
      return { status: 'PAID', orderId: payment.orderId };
    }
    return { status: 'FAILED' };
  }
}
