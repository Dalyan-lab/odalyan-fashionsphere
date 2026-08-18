import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as dns from 'node:dns';
import * as net from 'node:net';
import * as os from 'node:os';

/** Résultat d'une tentative de connexion TCP brute. */
export interface ProbeResult {
  address: string;
  family: 4 | 6;
  port: number;
  ok: boolean;
  ms: number;
  error?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;

  /**
   * Clé de l'API HTTPS d'envoi, prioritaire sur le SMTP.
   *
   * Beaucoup d'hébergeurs — Railway compris — bloquent le SMTP sortant pour
   * empêcher l'envoi de spam depuis leurs serveurs : les paquets vers les
   * ports 465 et 587 sont jetés sans réponse, ce qui se traduit par un
   * « Connection timeout » trompeur. Le HTTPS, lui, passe toujours.
   */
  private readonly resendKey = process.env.RESEND_API_KEY?.trim() || null;

  constructor() {
    if (process.env.SMTP_HOST) {
      const port = Number(process.env.SMTP_PORT ?? 587);
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        // Port 465 = TLS implicite ; 587/25 = STARTTLS (secure:false)
        secure: process.env.SMTP_SECURE === 'true' || port === 465,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
        // Échoue vite au lieu de geler les requêtes si le serveur SMTP est injoignable
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
    } else {
      this.transporter = null;
      if (!this.resendKey) this.logger.warn('Aucun canal d’envoi configuré — emails désactivés (mode dev).');
    }
  }

  get enabled(): boolean {
    return Boolean(this.resendKey || this.transporter);
  }

  /** Canal réellement utilisé pour les envois. */
  private get channel(): 'resend' | 'smtp' | null {
    if (this.resendKey) return 'resend';
    return this.transporter ? 'smtp' : null;
  }

  private get from(): string {
    return (
      process.env.MAIL_FROM ?? process.env.SMTP_FROM ?? 'Odalyan FashionSphere <no-reply@odalyan.ai>'
    );
  }

  /** Enveloppe HTML commune aux emails de la plateforme. */
  private wrap(title: string, body: string): string {
    return `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;padding:24px;color:#1a1226">
        <h2 style="margin:0 0 8px">${title}</h2>
        ${body}
        <p style="color:#888;font-size:12px;margin-top:28px">Odalyan FashionSphere AI™ — la mode du futur commence ici.</p>
      </div>`;
  }

  private async send(to: string, subject: string, html: string): Promise<boolean> {
    const { sent } = await this.trySend(to, subject, html);
    return sent;
  }

  /**
   * Envoi avec remontée de l'erreur, pour le diagnostic.
   *
   * `send()` avale volontairement les erreurs : un email raté ne doit jamais
   * faire échouer une commande ou une réinitialisation. Mais du coup, une
   * configuration SMTP fausse reste invisible depuis l'extérieur — d'où cette
   * variante qui rend le message d'erreur exploitable.
   */
  private async trySend(to: string, subject: string, html: string): Promise<{ sent: boolean; error?: string }> {
    const text = this.toText(html);
    if (this.resendKey) return this.sendViaResend(to, subject, html, text);
    if (!this.transporter) {
      return { sent: false, error: 'Aucun canal configuré (ni RESEND_API_KEY, ni SMTP_HOST).' };
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html, text });
      return { sent: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(`Échec d'envoi d'email: ${error}`);
      return { sent: false, error };
    }
  }

  /**
   * Version texte brut d'un email HTML.
   *
   * Un message qui ne contient que du HTML est un critère de notation
   * anti-spam : les expéditeurs légitimes envoient les deux versions. Les
   * liens sont conservés en clair, sans quoi le texte de repli serait
   * inutilisable — un email de réinitialisation sans son lien ne sert à rien.
   */
  private toText(html: string): string {
    return html
      .replace(/<a\b[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gis, '$2 : $1')
      .replace(/<li\b[^>]*>/gi, '- ')
      .replace(/<\/(p|div|h\d|li|ul|tr)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      // Décodage après le retrait des balises, sinon un &lt; décodé serait
      // repris pour une balise et le texte suivant disparaîtrait.
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/[ \t]+/g, ' ')
      // L'indentation du gabarit HTML laisse une espace en tête de chaque
      // ligne une fois les balises retirées.
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /** Envoi par l'API HTTPS de Resend — pas de dépendance, `fetch` suffit. */
  private async sendViaResend(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<{ sent: boolean; error?: string }> {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: this.from, to: [to], subject, html, text }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) return { sent: true };

      // Resend renvoie {name, message} en cas de refus : domaine non vérifié,
      // clé invalide, expéditeur non autorisé… Le message est explicite.
      const body: unknown = await res.json().catch(() => null);
      const detail =
        body && typeof body === 'object' && 'message' in body
          ? String((body as { message: unknown }).message)
          : `HTTP ${res.status}`;
      this.logger.error(`Échec d'envoi d'email (Resend): ${detail}`);
      return { sent: false, error: detail };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(`Échec d'envoi d'email (Resend): ${error}`);
      return { sent: false, error };
    }
  }

  /** Configuration SMTP visible pour le diagnostic — jamais le mot de passe. */
  status() {
    return {
      configured: this.enabled,
      channel: this.channel,
      host: process.env.SMTP_HOST ?? null,
      port: process.env.SMTP_PORT ?? '587 (défaut)',
      secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
      user: process.env.SMTP_USER ?? null,
      from: this.from,
    };
  }

  /**
   * Ouvre une connexion TCP nue vers une adresse, sans SMTP ni TLS.
   *
   * Sépare ce qui est indissociable dans l'erreur « Connection timeout » de
   * nodemailer : joindre le serveur, et dialoguer avec lui. Si la connexion
   * brute passe, le problème est dans l'authentification ; si elle expire,
   * c'est le réseau de l'hébergeur qui bloque.
   */
  private tcpProbe(address: string, family: 4 | 6, port: number): Promise<ProbeResult> {
    return new Promise((resolve) => {
      const started = Date.now();
      const socket = new net.Socket();
      const done = (ok: boolean, error?: string) => {
        socket.destroy();
        resolve({ address, family, port, ok, ms: Date.now() - started, error });
      };
      socket.setTimeout(6_000);
      socket.once('connect', () => done(true));
      socket.once('timeout', () => done(false, 'timeout (6 s)'));
      socket.once('error', (err) => done(false, err.message));
      socket.connect(port, address);
    });
  }

  /**
   * Diagnostic réseau exécuté depuis le serveur lui-même.
   *
   * Résout le serveur SMTP en IPv4 et IPv6, puis tente une connexion sur les
   * ports 465 et 587 pour chaque adresse. Dit précisément quelle combinaison
   * fonctionne — donc quoi mettre dans `SMTP_PORT`, ou s'il faut renoncer au
   * SMTP sortant chez cet hébergeur.
   */
  async probe(): Promise<{
    host: string | null;
    interfaces: { ipv4: boolean; ipv6: boolean };
    dns: { ipv4: string[]; ipv6: string[]; error?: string };
    probes: ProbeResult[];
  }> {
    const host = process.env.SMTP_HOST ?? null;
    const nics = Object.values(os.networkInterfaces())
      .flat()
      .filter((i): i is os.NetworkInterfaceInfo => Boolean(i) && !i!.internal);
    const interfaces = {
      ipv4: nics.some((i) => i.family === 'IPv4' || (i.family as unknown as number) === 4),
      ipv6: nics.some((i) => i.family === 'IPv6' || (i.family as unknown as number) === 6),
    };

    if (!host) return { host, interfaces, dns: { ipv4: [], ipv6: [] }, probes: [] };

    const lookup = async (fn: (h: string) => Promise<string[]>) => {
      try {
        return await fn(host);
      } catch {
        // Absence d'enregistrement = liste vide, pas une panne : un serveur
        // peut très bien n'avoir que de l'IPv4.
        return [];
      }
    };
    const ipv4 = await lookup(dns.promises.resolve4);
    const ipv6 = await lookup(dns.promises.resolve6);

    const targets: { address: string; family: 4 | 6 }[] = [
      ...ipv4.map((address) => ({ address, family: 4 as const })),
      ...ipv6.map((address) => ({ address, family: 6 as const })),
    ];
    const probes = await Promise.all(
      targets.flatMap((t) => [465, 587].map((port) => this.tcpProbe(t.address, t.family, port))),
    );

    return { host, interfaces, dns: { ipv4, ipv6 }, probes };
  }

  /** Envoie un email de test et renvoie le résultat réel, erreur comprise. */
  async sendTest(to: string): Promise<{ sent: boolean; error?: string }> {
    return this.trySend(
      to,
      'Test d’envoi — Odalyan FashionSphere',
      this.wrap(
        'Votre messagerie fonctionne ✅',
        '<p style="color:#555">Si vous lisez ce message, votre plateforme sait envoyer des emails : ' +
          'réinitialisations de mot de passe, confirmations de commande et alertes partiront normalement.</p>',
      ),
    );
  }

  /** Confirmation de commande envoyée au client après paiement réussi. */
  async sendOrderConfirmation(
    to: string,
    order: { orderNumber: string; total: string; items: { name: string; quantity: number }[] },
  ): Promise<boolean> {
    const rows = order.items
      .map((i) => `<li style="margin:4px 0">${i.quantity} × ${i.name}</li>`)
      .join('');
    const html = this.wrap(
      'Merci pour votre commande ! ✅',
      `<p style="color:#555">Votre paiement a bien été reçu. Récapitulatif de la commande <strong>${order.orderNumber}</strong> :</p>
       <ul style="color:#333;padding-left:20px">${rows}</ul>
       <p style="font-size:18px;font-weight:700;margin:16px 0">Total : ${order.total}</p>
       <p style="color:#555">Le vendeur prépare votre commande. Vous serez informé de son expédition.</p>`,
    );
    return this.send(to, `Commande ${order.orderNumber} confirmée — Odalyan`, html);
  }

  /**
   * Informe le client que sa commande a changé d'état.
   *
   * Envoyé à chaque étape — préparation, expédition, livraison, annulation —
   * parce qu'un acheteur sans nouvelles suppose le pire, puis réclame.
   */
  async sendOrderStatusUpdate(
    to: string,
    info: {
      orderNumber: string;
      shopName: string;
      status: 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
      carrier?: string | null;
      trackingNumber?: string | null;
      trackingUrl?: string | null;
      ordersUrl: string;
    },
  ): Promise<boolean> {
    const wording = {
      PROCESSING: {
        subject: 'est en préparation',
        title: 'Votre commande est en préparation 📦',
        lead: `<strong>${info.shopName}</strong> prépare votre commande. Vous serez prévenu dès son expédition.`,
      },
      SHIPPED: {
        subject: 'a été expédiée',
        title: 'Votre commande est en route 🚚',
        lead: `<strong>${info.shopName}</strong> a expédié votre commande.`,
      },
      DELIVERED: {
        subject: 'a été livrée',
        title: 'Votre commande est livrée ✅',
        lead: `Votre commande a été marquée comme livrée par <strong>${info.shopName}</strong>. Un problème ? Répondez à cet email.`,
      },
      CANCELLED: {
        subject: 'a été annulée',
        title: 'Votre commande a été annulée',
        lead: `<strong>${info.shopName}</strong> a annulé votre commande. Si elle avait été réglée, le remboursement vous sera adressé.`,
      },
    }[info.status];

    // Le suivi n'est affiché que s'il existe : une section vide inquiéterait
    // plus qu'elle n'informerait.
    const tracking =
      info.carrier || info.trackingNumber
        ? `<p style="background:#f4f1f8;border-radius:10px;padding:12px 16px;color:#333">
             ${info.carrier ? `Transporteur : <strong>${info.carrier}</strong><br>` : ''}
             ${info.trackingNumber ? `Numéro de suivi : <strong>${info.trackingNumber}</strong>` : ''}
             ${info.trackingUrl ? `<br><a href="${info.trackingUrl}" style="color:#7c3aed">Suivre mon colis</a>` : ''}
           </p>`
        : '';

    const html = this.wrap(
      wording.title,
      `<p style="color:#555">${wording.lead}</p>
       <p style="color:#555">Commande <strong>${info.orderNumber}</strong>.</p>
       ${tracking}
       <p style="text-align:center;margin:28px 0">
         <a href="${info.ordersUrl}" style="background:linear-gradient(135deg,#7c3aed,#c0306a);color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">Voir ma commande</a>
       </p>`,
    );
    return this.send(to, `Commande ${info.orderNumber} ${wording.subject} — Odalyan`, html);
  }

  /** Prévient le vendeur qu'une demande de remboursement l'attend. */
  async sendRefundRequested(
    to: string,
    info: { orderNumber: string; ordersUrl: string },
  ): Promise<boolean> {
    const html = this.wrap(
      'Demande de remboursement 🔁',
      `<p style="color:#555">Un client demande le remboursement de la commande <strong>${info.orderNumber}</strong>.</p>
       <p style="color:#555">Une réponse rapide évite qu'il se tourne vers sa banque, ce qui coûterait bien plus cher à tout le monde.</p>
       <p style="text-align:center;margin:28px 0">
         <a href="${info.ordersUrl}" style="background:linear-gradient(135deg,#7c3aed,#c0306a);color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">Voir la demande</a>
       </p>`,
    );
    return this.send(to, `Remboursement demandé — commande ${info.orderNumber}`, html);
  }

  /** Informe le client de la suite donnée à sa demande. */
  async sendRefundDecision(
    to: string,
    info: { orderNumber: string; approved: boolean; note?: string; ordersUrl: string },
  ): Promise<boolean> {
    const title = info.approved ? 'Votre remboursement est accordé ✅' : 'Votre demande de remboursement a été refusée';
    const lead = info.approved
      ? `Le remboursement de la commande <strong>${info.orderNumber}</strong> a été accordé. Le montant vous sera reversé par le moyen utilisé lors du paiement.`
      : `La demande de remboursement pour la commande <strong>${info.orderNumber}</strong> n'a pas été retenue.`;
    const html = this.wrap(
      title,
      `<p style="color:#555">${lead}</p>
       ${info.note ? `<p style="background:#f4f1f8;border-radius:10px;padding:12px 16px;color:#333">${info.note}</p>` : ''}
       <p style="text-align:center;margin:28px 0">
         <a href="${info.ordersUrl}" style="background:linear-gradient(135deg,#7c3aed,#c0306a);color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">Voir ma commande</a>
       </p>`,
    );
    return this.send(to, `Remboursement ${info.approved ? 'accordé' : 'refusé'} — ${info.orderNumber}`, html);
  }

  /** Notification envoyée au vendeur quand une commande est payée. */
  async sendNewOrderNotification(
    to: string,
    order: {
      orderNumber: string;
      total: string;
      customerName: string;
      items: { name: string; quantity: number }[];
    },
  ): Promise<boolean> {
    const rows = order.items
      .map((i) => `<li style="margin:4px 0">${i.quantity} × ${i.name}</li>`)
      .join('');
    const html = this.wrap(
      'Nouvelle commande payée ! 🎉',
      `<p style="color:#555"><strong>${order.customerName}</strong> vient de payer la commande <strong>${order.orderNumber}</strong> :</p>
       <ul style="color:#333;padding-left:20px">${rows}</ul>
       <p style="font-size:18px;font-weight:700;margin:16px 0">Total : ${order.total}</p>
       <p style="color:#555">Rendez-vous dans votre tableau de bord (Commandes) pour la préparer et l'expédier.</p>`,
    );
    return this.send(to, `Nouvelle commande ${order.orderNumber} — Odalyan`, html);
  }

  /** Rappel d'expiration d'abonnement (envoyé à J-3, puis à l'expiration). */
  async sendSubscriptionExpiring(
    to: string,
    info: { plan: string; expiresOn: string; daysLeft: number; renewUrl: string },
  ): Promise<boolean> {
    const expired = info.daysLeft <= 0;
    const title = expired ? 'Votre plan a expiré ⏳' : 'Votre plan expire bientôt ⏳';
    const lead = expired
      ? `Votre plan <strong>${info.plan}</strong> a expiré le <strong>${info.expiresOn}</strong>. Renouvelez-le pour garder vos fonctionnalités IA et vos crédits.`
      : `Votre plan <strong>${info.plan}</strong> expire le <strong>${info.expiresOn}</strong> (dans ${info.daysLeft} jour${info.daysLeft > 1 ? 's' : ''}). Renouvelez en un clic pour ne rien perdre.`;
    const html = this.wrap(
      title,
      `<p style="color:#555">${lead}</p>
       <p style="text-align:center;margin:28px 0">
         <a href="${info.renewUrl}" style="background:linear-gradient(135deg,#7c3aed,#c0306a);color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">Renouveler mon plan</a>
       </p>
       <p style="color:#888;font-size:12px">Paiement ponctuel — Wave, Orange Money, MTN, Moov &amp; carte. Aucun prélèvement automatique.</p>`,
    );
    return this.send(to, expired ? `Votre plan ${info.plan} a expiré — Odalyan` : `Votre plan expire bientôt — Odalyan`, html);
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<boolean> {
    const html = this.wrap(
      'Réinitialisation de votre mot de passe',
      `<p style="color:#555">Vous avez demandé à réinitialiser votre mot de passe Odalyan FashionSphere.</p>
       <p style="text-align:center;margin:28px 0">
         <a href="${resetUrl}" style="background:linear-gradient(135deg,#7c3aed,#c0306a);color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">Réinitialiser mon mot de passe</a>
       </p>
       <p style="color:#888;font-size:12px">Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
    );
    return this.send(to, 'Réinitialisation de votre mot de passe — Odalyan', html);
  }
}
