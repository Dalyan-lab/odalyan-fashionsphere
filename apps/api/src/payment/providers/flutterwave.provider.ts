import { Injectable, Logger } from '@nestjs/common';

export interface FlwLinkInput {
  orderId: string;
  orderNumber: string;
  amountEur: number;
  email: string;
  name: string;
}

export interface FlwLinkResult {
  link: string;
  txRef: string;
  amount: number;
  currency: string;
}

export interface FlwVerifyResult {
  successful: boolean;
  amount?: number;
  currency?: string;
  txRef?: string;
}

/**
 * Flutterwave — paiement Afrique (carte + Mobile Money : Orange, MTN, Moov, Wave).
 * Flux « Standard » : on crée un lien de paiement hébergé, l'utilisateur paie, puis on vérifie.
 */
@Injectable()
export class FlutterwaveProvider {
  private readonly logger = new Logger(FlutterwaveProvider.name);
  private readonly base = 'https://api.flutterwave.com/v3';

  get enabled(): boolean {
    return Boolean(process.env.FLW_SECRET_KEY);
  }

  get currency(): string {
    return process.env.FLW_CURRENCY ?? 'XOF';
  }

  /** Convertit l'EUR vers la devise locale (défaut XOF, 1 EUR ≈ 655,957 XOF). */
  private convert(amountEur: number): number {
    const rate = Number(process.env.FLW_EUR_RATE ?? 655.957);
    return Math.max(1, Math.round(amountEur * rate));
  }

  async createLink(input: FlwLinkInput): Promise<FlwLinkResult> {
    const amount = this.convert(input.amountEur);
    const txRef = `ODL-${input.orderNumber}-${Date.now()}`;
    const webOrigin = process.env.WEB_ORIGIN?.split(',')[0] ?? 'http://localhost:3000';

    const res = await fetch(`${this.base}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount,
        currency: this.currency,
        redirect_url: `${webOrigin}/payment/callback`,
        customer: { email: input.email, name: input.name },
        customizations: {
          title: 'Odalyan FashionSphere',
          description: `Commande ${input.orderNumber}`,
        },
        meta: { orderId: input.orderId },
      }),
    });

    const data = (await res.json()) as { status?: string; data?: { link?: string }; message?: string };
    if (data.status === 'success' && data.data?.link) {
      return { link: data.data.link, txRef, amount, currency: this.currency };
    }
    this.logger.error(`Flutterwave create a échoué: ${data.message ?? JSON.stringify(data)}`);
    throw new Error('flutterwave_create_failed');
  }

  async verify(transactionId: string): Promise<FlwVerifyResult> {
    const res = await fetch(`${this.base}/transactions/${transactionId}/verify`, {
      headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
    });
    const data = (await res.json()) as {
      status?: string;
      data?: { status?: string; amount?: number; currency?: string; tx_ref?: string };
    };
    const d = data.data;
    return {
      successful: data.status === 'success' && d?.status === 'successful',
      amount: d?.amount,
      currency: d?.currency,
      txRef: d?.tx_ref,
    };
  }
}
