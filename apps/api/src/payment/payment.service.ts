import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { PaymentProvider } from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FlutterwaveProvider } from './providers/flutterwave.provider';
import {
  CinetpayProvider,
  CinetpayUnreachableError,
} from './providers/cinetpay.provider';
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
    private readonly flutterwave: FlutterwaveProvider,
    private readonly cinetpay: CinetpayProvider,
    private readonly paystack: PaystackProvider,
  ) {
    const key = process.env.STRIPE_SECRET_KEY;
    this.stripe = key ? new Stripe(key) : null;
    if (
      !this.stripe &&
      !this.paystack.enabled &&
      !this.flutterwave.enabled &&
      !this.cinetpay.enabled
    ) {
      this.logger.warn('Aucun fournisseur de paiement configuré — mode simulé (mock) activé.');
    }
  }

  /** Quel fournisseur est actif (pour le frontend). */
  config() {
    return {
      provider: this.paystack.enabled
        ? 'paystack'
        : this.cinetpay.enabled
          ? 'cinetpay'
          : this.flutterwave.enabled
            ? 'flutterwave'
            : this.stripe
              ? 'stripe'
              : 'mock',
    };
  }

  /**
   * Crée l'enregistrement de paiement.
   * Priorité : CinetPay > Flutterwave > Stripe > simulé.
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

    // ----- CinetPay (Wave/Orange/MTN/Moov + carte, Afrique de l'Ouest) -----
    if (this.cinetpay.enabled) {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { customer: true },
      });
      const addr = (order!.shippingAddress ?? {}) as Record<string, unknown>;
      try {
        const cp = await this.cinetpay.createLink({
          orderId,
          orderNumber: order!.orderNumber,
          amountEur: Number(amount),
          email: order!.customer.email,
          name: `${order!.customer.firstName} ${order!.customer.lastName}`,
          phone: typeof addr.phone === 'string' ? addr.phone : undefined,
          city: typeof addr.city === 'string' ? addr.city : undefined,
          address: typeof addr.line1 === 'string' ? addr.line1 : undefined,
        });
        return await this.prisma.payment.create({
          data: {
            orderId,
            provider: PaymentProvider.CINETPAY,
            providerRef: cp.txRef,
            amount,
            currency,
            paid: false,
            rawPayload: {
              link: cp.link,
              txRef: cp.txRef,
              chargedAmount: cp.amount,
              chargedCurrency: cp.currency,
            } as Prisma.InputJsonValue,
          },
        });
      } catch (err) {
        // En dev, si CinetPay est injoignable (réseau filtré), on bascule en mode
        // simulé pour permettre de tester le flux complet. En prod, on remonte l'erreur.
        const unreachable = err instanceof CinetpayUnreachableError;
        if (unreachable && process.env.NODE_ENV !== 'production') {
          this.logger.warn(
            'CinetPay injoignable en dev — repli sur paiement simulé pour cette commande.',
          );
          return this.createMockPayment(orderId, amount, currency);
        }
        this.logger.error(`Échec du paiement CinetPay : ${(err as Error).message}`);
        throw new ServiceUnavailableException(
          unreachable
            ? 'Service de paiement momentanément injoignable. Réessayez dans un instant.'
            : 'Le paiement a été refusé par CinetPay. Vérifiez les informations de la commande.',
        );
      }
    }

    // ----- Flutterwave (carte + Mobile Money Afrique) -----
    if (this.flutterwave.enabled) {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { customer: true },
      });
      const fw = await this.flutterwave.createLink({
        orderId,
        orderNumber: order!.orderNumber,
        amountEur: Number(amount),
        email: order!.customer.email,
        name: `${order!.customer.firstName} ${order!.customer.lastName}`,
      });
      return this.prisma.payment.create({
        data: {
          orderId,
          provider: PaymentProvider.FLUTTERWAVE,
          providerRef: fw.txRef,
          amount,
          currency,
          paid: false,
          rawPayload: {
            link: fw.link,
            txRef: fw.txRef,
            chargedAmount: fw.amount,
            chargedCurrency: fw.currency,
          } as Prisma.InputJsonValue,
        },
      });
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
    return payment;
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
      }
    }

    return { received: true };
  }

  /** Vérifie une transaction Flutterwave et marque la commande payée si réussie. */
  async verifyFlutterwave(transactionId: string) {
    if (!this.flutterwave.enabled) return { status: 'MOCK' };
    const v = await this.flutterwave.verify(transactionId);
    const payment = v.txRef
      ? await this.prisma.payment.findFirst({ where: { providerRef: v.txRef } })
      : null;

    if (payment && v.successful) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { paid: true, rawPayload: { transactionId, verified: true } as Prisma.InputJsonValue },
      });
      await this.prisma.order.update({ where: { id: payment.orderId }, data: { status: 'PAID' } });
      return { status: 'PAID', orderId: payment.orderId };
    }
    return { status: 'FAILED' };
  }

  /** Vérifie une transaction Paystack (reference = notre txRef) et marque payé si success. */
  async verifyPaystack(reference: string) {
    if (!this.paystack.enabled) return { status: 'MOCK' };
    const v = await this.paystack.verify(reference);
    const payment = await this.prisma.payment.findFirst({ where: { providerRef: reference } });
    if (payment && v.successful) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { paid: true, rawPayload: { reference, verified: true } as Prisma.InputJsonValue },
      });
      await this.prisma.order.update({ where: { id: payment.orderId }, data: { status: 'PAID' } });
      return { status: 'PAID', orderId: payment.orderId };
    }
    return { status: 'FAILED' };
  }

  /** Vérifie une transaction CinetPay (txRef = notre transaction_id) et marque payé si ACCEPTED. */
  async verifyCinetpay(txRef: string) {
    if (!this.cinetpay.enabled) return { status: 'MOCK' };
    const v = await this.cinetpay.verify(txRef);
    const payment = await this.prisma.payment.findFirst({ where: { providerRef: txRef } });
    if (payment && v.successful) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { paid: true, rawPayload: { txRef, verified: true } as Prisma.InputJsonValue },
      });
      await this.prisma.order.update({ where: { id: payment.orderId }, data: { status: 'PAID' } });
      return { status: 'PAID', orderId: payment.orderId };
    }
    return { status: 'FAILED' };
  }
}
