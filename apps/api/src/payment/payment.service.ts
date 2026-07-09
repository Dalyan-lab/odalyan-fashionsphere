import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { PaymentProvider } from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
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
  async createPaymentForOrder(orderId: string, amount: Prisma.Decimal, currency: string) {
    // ----- Paystack (carte + Mobile Money Wave/Orange/MTN/Moov, XOF) -----
    if (this.paystack.enabled) {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { customer: true },
      });
      const addr = (order!.shippingAddress ?? {}) as Record<string, unknown>;
      try {
        const ps = await this.paystack.createLink({
          orderId,
          orderNumber: order!.orderNumber,
          amountEur: Number(amount),
          email: order!.customer.email,
          name: `${order!.customer.firstName} ${order!.customer.lastName}`,
          phone: typeof addr.phone === 'string' ? addr.phone : undefined,
        });
        return await this.prisma.payment.create({
          data: {
            orderId,
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
          return this.createMockPayment(orderId, amount, currency);
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
        metadata: { orderId },
        automatic_payment_methods: { enabled: true },
      });

      return this.prisma.payment.create({
        data: {
          orderId,
          provider: PaymentProvider.STRIPE,
          providerRef: intent.id,
          amount,
          currency,
          rawPayload: { clientSecret: intent.client_secret } as Prisma.InputJsonValue,
        },
      });
    }

    // Mode mock — paiement marqué payé immédiatement (dev uniquement)
    return this.createMockPayment(orderId, amount, currency);
  }

  /** Paiement simulé : marqué payé immédiatement et commande passée en PAID (dev). */
  private async createMockPayment(orderId: string, amount: Prisma.Decimal, currency: string) {
    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        provider: PaymentProvider.STRIPE,
        providerRef: `mock_${orderId}`,
        amount,
        currency,
        paid: true,
        rawPayload: { mock: true } as Prisma.InputJsonValue,
      },
    });
    await this.prisma.order.update({ where: { id: orderId }, data: { status: 'PAID' } });
    void this.notifyOrderPaid(orderId);
    return payment;
  }

  /**
   * Emails transactionnels après paiement réussi : confirmation au client +
   * notification au vendeur. Ne bloque jamais le flux de paiement (erreurs logguées).
   */
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
      const orderId = intent.metadata?.orderId;
      if (orderId) {
        await this.prisma.payment.updateMany({
          where: { orderId },
          data: { paid: true, rawPayload: intent as unknown as Prisma.InputJsonValue },
        });
        await this.prisma.order.update({ where: { id: orderId }, data: { status: 'PAID' } });
        void this.notifyOrderPaid(orderId);
      }
    }

    return { received: true };
  }

  /** Vérifie une transaction Paystack (reference = notre txRef) et marque payé si success. */
  async verifyPaystack(reference: string) {
    if (!this.paystack.enabled) return { status: 'MOCK' };
    const v = await this.paystack.verify(reference);
    const payment = await this.prisma.payment.findFirst({ where: { providerRef: reference } });
    if (payment && v.successful) {
      // Idempotence : n'envoie les emails qu'à la première confirmation
      const firstConfirmation = !payment.paid;
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { paid: true, rawPayload: { reference, verified: true } as Prisma.InputJsonValue },
      });
      await this.prisma.order.update({ where: { id: payment.orderId }, data: { status: 'PAID' } });
      if (firstConfirmation) void this.notifyOrderPaid(payment.orderId);
      return { status: 'PAID', orderId: payment.orderId };
    }
    return { status: 'FAILED' };
  }
}
