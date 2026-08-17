import { Injectable, Logger } from '@nestjs/common';
import { PLATFORM_CURRENCY } from '@odalyan/shared';
import { appUrl } from '../../common/app-url';

export interface PsLinkInput {
  /** Identifiant du panier payé (groupe de commandes). */
  refId: string;
  /** Référence lisible, reprise dans le libellé de la transaction. */
  refNumber: string;
  amount: number;
  email: string;
  name: string;
  phone?: string;
}

export interface PsGenericLinkInput {
  reference: string;
  amount: number;
  email: string;
  /** Suffixe ajouté au callback (?kind=…) pour router la vérification côté web. */
  kind?: string;
  metadata?: Record<string, unknown>;
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

  /**
   * Montant à facturer, dans la devise de Paystack.
   *
   * La plateforme stocke désormais ses montants en FCFA, soit la devise de
   * facturation : plus aucune conversion. `PAYSTACK_EUR_RATE` n'est conservée
   * que pour un compte configuré dans une autre devise que XOF — sans quoi
   * une transaction partirait multipliée par 656.
   */
  private toChargeable(amount: number): number {
    if (this.currency === PLATFORM_CURRENCY) return Math.max(1, Math.round(amount));
    const rate = Number(process.env.PAYSTACK_EUR_RATE ?? 655.957);
    return Math.max(1, Math.round((amount / rate) * this.foreignRate()));
  }

  /** Taux vers la devise Paystack quand elle diffère de celle de la plateforme. */
  private foreignRate(): number {
    return Number(process.env.PAYSTACK_TARGET_RATE ?? 1);
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
    const localAmount = this.toChargeable(input.amount);
    const txRef = `ODL-${input.refNumber}-${Date.now()}`;
    const webOrigin = appUrl();

    const res = await this.request('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        amount: localAmount * 100, // sous-unité : XOF × 100 (exigence Paystack)
        currency: this.currency,
        reference: txRef,
        callback_url: `${webOrigin}/payment/callback?provider=paystack`,
        metadata: {
          groupId: input.refId,
          reference: input.refNumber,
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

  /**
   * Lien de paiement générique (hors commande) : recharge de crédits IA.
   * Réutilise le même flux hébergé Paystack ; la vérification passe par verify().
   */
  async createGenericLink(input: PsGenericLinkInput): Promise<PsLinkResult> {
    const localAmount = this.toChargeable(input.amount);
    const webOrigin = appUrl();
    const kind = input.kind ? `&kind=${encodeURIComponent(input.kind)}` : '';

    const res = await this.request('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        amount: localAmount * 100, // sous-unité : XOF × 100
        currency: this.currency,
        reference: input.reference,
        callback_url: `${webOrigin}/payment/callback?provider=paystack${kind}`,
        metadata: input.metadata ?? {},
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
        txRef: data.data.reference ?? input.reference,
        amount: localAmount,
        currency: this.currency,
      };
    }
    const detail = data.message ?? JSON.stringify(data);
    this.logger.error(`Paystack initialize (crédits) a échoué : ${detail}`);
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
