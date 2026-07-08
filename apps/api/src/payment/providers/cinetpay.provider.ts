import { Injectable, Logger } from '@nestjs/common';

export interface CpLinkInput {
  orderId: string;
  orderNumber: string;
  amountEur: number;
  email: string;
  name: string;
  phone?: string;
  city?: string;
  address?: string;
}

export interface CpLinkResult {
  link: string;
  txRef: string;
  amount: number;
  currency: string;
}

/** Erreur réseau : impossible de joindre les serveurs CinetPay (DNS/connexion). */
export class CinetpayUnreachableError extends Error {
  constructor(cause: string) {
    super(`cinetpay_unreachable: ${cause}`);
    this.name = 'CinetpayUnreachableError';
  }
}

/** Erreur métier : CinetPay a répondu mais a refusé la création du lien. */
export class CinetpayApiError extends Error {
  constructor(message: string) {
    super(`cinetpay_create_failed: ${message}`);
    this.name = 'CinetpayApiError';
  }
}

/**
 * CinetPay — paiement Afrique de l'Ouest (Wave, Orange Money, MTN, Moov + carte).
 * Flux : POST /v2/payment → URL de paiement hébergée ; /v2/payment/check pour vérifier.
 * Identifiants requis : CINETPAY_API_KEY + CINETPAY_SITE_ID.
 */
@Injectable()
export class CinetpayProvider {
  private readonly logger = new Logger(CinetpayProvider.name);
  private readonly base = 'https://api-checkout.cinetpay.com/v2';

  get enabled(): boolean {
    return Boolean(process.env.CINETPAY_API_KEY && process.env.CINETPAY_SITE_ID);
  }

  get currency(): string {
    return process.env.CINETPAY_CURRENCY ?? 'XOF';
  }

  /** Convertit l'EUR vers XOF, arrondi au multiple de 5 (exigence CinetPay). */
  private convert(amountEur: number): number {
    const rate = Number(process.env.CINETPAY_EUR_RATE ?? process.env.FLW_EUR_RATE ?? 655.957);
    const xof = Math.round(amountEur * rate);
    return Math.max(5, Math.round(xof / 5) * 5);
  }

  /** POST JSON vers CinetPay avec timeout ; convertit l'échec réseau en erreur typée. */
  private async post(path: string, body: unknown): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      return await fetch(`${this.base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`CinetPay injoignable (${path}) : ${reason}`);
      throw new CinetpayUnreachableError(reason);
    } finally {
      clearTimeout(timeout);
    }
  }

  async createLink(input: CpLinkInput): Promise<CpLinkResult> {
    const amount = this.convert(input.amountEur);
    const txRef = `ODL-${input.orderNumber}-${Date.now()}`;
    const webOrigin = process.env.WEB_ORIGIN?.split(',')[0] ?? 'http://localhost:3000';
    const apiBase = process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
    const [firstName, ...rest] = (input.name || 'Client').split(' ');

    const res = await this.post('/payment', {
      apikey: process.env.CINETPAY_API_KEY,
      site_id: process.env.CINETPAY_SITE_ID,
      transaction_id: txRef,
      amount,
      currency: this.currency,
      description: `Commande ${input.orderNumber} — Odalyan FashionSphere`,
      channels: 'ALL',
      return_url: `${webOrigin}/payment/callback?provider=cinetpay&txid=${txRef}`,
      notify_url: `${apiBase}/api/payments/cinetpay/notify`,
      customer_email: input.email,
      customer_name: firstName,
      customer_surname: rest.join(' ') || firstName,
      // Champs de facturation requis par CinetPay pour le canal carte.
      customer_phone_number: input.phone ?? '',
      customer_address: input.address ?? 'Abidjan',
      customer_city: input.city ?? 'Abidjan',
      customer_country: 'CI',
      customer_state: 'CI',
      customer_zip_code: '00225',
    });

    const data = (await res.json()) as {
      code?: string;
      data?: { payment_url?: string };
      message?: string;
      description?: string;
    };
    if (data.code === '201' && data.data?.payment_url) {
      return { link: data.data.payment_url, txRef, amount, currency: this.currency };
    }
    const detail = data.description ?? data.message ?? JSON.stringify(data);
    this.logger.error(`CinetPay create a échoué (code ${data.code}): ${detail}`);
    throw new CinetpayApiError(detail);
  }

  /** Vérifie l'état d'une transaction. Renvoie successful=true si ACCEPTED. */
  async verify(txRef: string): Promise<{ successful: boolean }> {
    const res = await this.post('/payment/check', {
      apikey: process.env.CINETPAY_API_KEY,
      site_id: process.env.CINETPAY_SITE_ID,
      transaction_id: txRef,
    });
    const data = (await res.json()) as { code?: string; data?: { status?: string } };
    return { successful: data.code === '00' && data.data?.status === 'ACCEPTED' };
  }
}
