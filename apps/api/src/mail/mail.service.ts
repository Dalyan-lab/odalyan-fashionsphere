import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

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
    if (!this.transporter) return false;
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
      return true;
    } catch (err) {
      this.logger.error(`Échec d'envoi d'email: ${String(err)}`);
      return false;
    }
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
