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
      this.logger.warn('SMTP non configuré — emails désactivés (mode dev).');
    }
  }

  get enabled(): boolean {
    return Boolean(this.transporter);
  }

  private get from(): string {
    return process.env.SMTP_FROM ?? 'Odalyan FashionSphere <no-reply@odalyan.ai>';
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
    if (!this.transporter) return { sent: false, error: 'SMTP non configuré (SMTP_HOST absent).' };
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
      return { sent: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(`Échec d'envoi d'email: ${error}`);
      return { sent: false, error };
    }
  }

  /** Configuration SMTP visible pour le diagnostic — jamais le mot de passe. */
  status() {
    return {
      configured: this.enabled,
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
    if (!this.transporter) return false;
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1a1226">
        <h2 style="margin:0 0 8px">Réinitialisation de votre mot de passe</h2>
        <p style="color:#555">Vous avez demandé à réinitialiser votre mot de passe Odalyan FashionSphere.</p>
        <p style="text-align:center;margin:28px 0">
          <a href="${resetUrl}" style="background:linear-gradient(135deg,#7c3aed,#c0306a);color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">Réinitialiser mon mot de passe</a>
        </p>
        <p style="color:#888;font-size:12px">Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
      </div>`;
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Réinitialisation de votre mot de passe — Odalyan',
        html,
      });
      return true;
    } catch (err) {
      this.logger.error(`Échec d'envoi d'email: ${String(err)}`);
      return false;
    }
  }
}
