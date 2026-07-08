import { Injectable, Logger } from '@nestjs/common';

export interface PsLinkInput {
  orderId: string;
  orderNumber: string;
  amountEur: number;
  email: string;
  name: string;
  phone?: string;
}

export interface PsLinkResult {
  link: string;
  txRef: string;
  amount: number;
  currency: string;
}

/** Erreur réseau : impossible de joindre les serveurs Paystack. */
export class PaystackUnreachableError extends Error {
  constructor(cause: string) {
    super(`paystack_unreachable: ${cause}`);
    this.name = 'PaystackUnreachableError';
  }
}

/** Erreur métier : Paystack a répondu mais a refusé l'opération. */
export class PaystackApiError extends Error {
  constructor(message: string) {
    super(`paystack_failed: ${message}`);
    this.name = 'PaystackApiError';
  }
}

/**
 * Paystack — paiement Afrique (Côte d'Ivoire, Nigeria, Ghana…).
 * Supporte carte + Mobile Money (Wave, Orange, MTN, Moov) en XOF.
 * Flux : POST /transaction/initialize → authorization_url (page hébergée) ;
 *        GET /transaction/verify/:reference pour confirmer.
 * Auth : header « Authorization: Bearer <SECRET_KEY> ».
 * Montant : en sous-unité → XOF × 100 (exigence Paystack, même sans décimale).
 */
@Injectable()
export class PaystackProvider {
  private readonly logger = new Logger(PaystackProvider.name);
  private readonly base = 'https://api.paystack.co';

  get enabled(): boolean {
    return Boolean(process.env.PAYSTACK_SECRET_KEY);
  }

  get currency(): string {
    return process.env.PAYSTACK_CURRENCY ?? 'XOF';
  }

  /** Convertit l'EUR vers la devise locale (défaut XOF, 1 EUR ≈ 655,957 XOF). */
  private convert(amountEur: number): number {
    const rate = Number(process.env.PAYSTACK_EUR_RATE ?? process.env.FLW_EUR_RATE ?? 655.957);
    return Math.max(1, Math.round(amountEur * rate));
  }

  /** Requête HTTP vers Paystack avec timeout ; convertit l'échec réseau en erreur typée. */
  private async request(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      return await fetch(`${this.base}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
        signal: controller.signal,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`Paystack injoignable (${path}) : ${reason}`);
      throw new PaystackUnreachableError(reason);
    } finally {
      clearTimeout(timeout);
    }
  }

  async createLink(input: PsLinkInput): Promise<PsLinkResult> {
    const localAmount = this.convert(input.amountEur);
    const txRef = `ODL-${input.orderNumber}-${Date.now()}`;
    const webOrigin = process.env.WEB_ORIGIN?.split(',')[0] ?? 'http://localhost:3000';

    const res = await this.request('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        amount: localAmount * 100, // sous-unité : XOF × 100 (exigence Paystack)
        currency: this.currency,
        reference: txRef,
        callback_url: `${webOrigin}/payment/callback?provider=paystack`,
        metadata: {
          orderId: input.orderId,
          orderNumber: input.orderNumber,
          customer_name: input.name,
          phone: input.phone ?? '',
        },
      }),
    });

    const data = (await res.json()) as {
      status?: boolean;
      message?: string;
      data?: { authorization_url?: string; reference?: string };
    };
    if (data.status === true && data.data?.authorization_url) {
      return {
        link: data.data.authorization_url,
        txRef: data.data.reference ?? txRef,
        amount: localAmount,
        currency: this.currency,
      };
    }
    const detail = data.message ?? JSON.stringify(data);
    this.logger.error(`Paystack initialize a échoué : ${detail}`);
    throw new PaystackApiError(detail);
  }

  /** Vérifie une transaction. Renvoie successful=true si status='success'. */
  async verify(reference: string): Promise<{ successful: boolean }> {
    const res = await this.request(`/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
    });
    const data = (await res.json()) as {
      status?: boolean;
      data?: { status?: string };
    };
    return { successful: data.status === true && data.data?.status === 'success' };
  }
}
