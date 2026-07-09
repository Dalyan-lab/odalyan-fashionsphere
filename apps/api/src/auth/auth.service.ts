import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import {
  UserRole,
  type AuthResponse,
  type AuthUser,
  type LoginInput,
  type RegisterInput,
} from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException('Un compte existe déjà avec cet email');

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role ?? UserRole.CUSTOMER,
      },
    });

    return this.buildAuthResponse(this.toAuthUser(user));
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Email ou mot de passe incorrect');

    return this.buildAuthResponse(this.toAuthUser(user));
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }
    // Rotation : on révoque l'ancien token
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.buildAuthResponse(this.toAuthUser(stored.user));
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken
      .updateMany({ where: { tokenHash }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }

  /**
   * Démarre une réinitialisation : génère un jeton, le stocke (haché) avec expiration.
   * En l'absence d'email configuré (SMTP), renvoie directement le lien (mode dev).
   */
  async forgotPassword(email: string): Promise<{ message: string; resetUrl?: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const genericMessage = 'Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.';
    if (!user) return { message: genericMessage };

    const token = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: this.hashToken(token),
        resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1 heure
      },
    });

    const webOrigin = process.env.WEB_ORIGIN?.split(',')[0] ?? 'http://localhost:3000';
    const resetUrl = `${webOrigin}/reset-password?token=${token}`;

    // SMTP configuré → envoi par email ; sinon (dev) on renvoie le lien directement.
    if (this.mail.enabled) {
      await this.mail.sendPasswordReset(user.email, resetUrl);
      return { message: genericMessage };
    }
    return { message: genericMessage, resetUrl };
  }

  /** Réinitialise le mot de passe à partir d'un jeton valide. */
  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: {
        resetTokenHash: this.hashToken(token),
        resetTokenExpiry: { gt: new Date() },
      },
    });
    if (!user) throw new UnauthorizedException('Lien invalide ou expiré. Refaites une demande.');

    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetTokenHash: null, resetTokenExpiry: null },
    });
    // Révoque les sessions existantes par sécurité
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' };
  }

  /**
   * Change le mot de passe de l'utilisateur connecté (page Paramètres).
   * Comptes OAuth (sans mot de passe) : définit directement le nouveau.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Le nouveau mot de passe doit contenir au moins 8 caractères.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Utilisateur introuvable');

    if (user.passwordHash) {
      const valid = await bcrypt.compare(currentPassword ?? '', user.passwordHash);
      if (!valid) throw new UnauthorizedException('Mot de passe actuel incorrect.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { message: 'Mot de passe mis à jour.' };
  }

  /** Passe un compte Client en Vendeur (pour ouvrir une boutique). */
  async becomeSeller(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Utilisateur introuvable');
    const updated =
      user.role === UserRole.CUSTOMER
        ? await this.prisma.user.update({ where: { id: userId }, data: { role: UserRole.SELLER } })
        : user;
    return this.toAuthUser(updated);
  }

  /** Fournisseurs OAuth configurés (clés présentes). */
  oauthEnabled() {
    return {
      google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    };
  }

  /** Connexion/création de compte via un profil OAuth (Google, GitHub). */
  async oauthLogin(input: {
    provider: 'google' | 'github';
    providerId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  }): Promise<AuthResponse> {
    let user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: input.email,
          firstName: input.firstName || 'Utilisateur',
          lastName: input.lastName || '',
          role: UserRole.CUSTOMER,
          avatarUrl: input.avatarUrl,
          ...(input.provider === 'google' ? { googleId: input.providerId } : {}),
        },
      });
    } else if (input.provider === 'google' && !user.googleId) {
      await this.prisma.user.update({ where: { id: user.id }, data: { googleId: input.providerId } });
    }
    return this.buildAuthResponse(this.toAuthUser(user));
  }

  private async buildAuthResponse(user: AuthUser): Promise<AuthResponse> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-in-prod',
        expiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
      },
    );

    const refreshToken = randomBytes(48).toString('hex');
    const refreshTtlDays = 7;
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000),
      },
    });

    return { user, tokens: { accessToken, refreshToken } };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as UserRole,
    };
  }
}
