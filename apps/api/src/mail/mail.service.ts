import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;

  constructor() {
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
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
