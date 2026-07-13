import { ForbiddenException, Injectable } from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';
import { PLAN_AI_CREDITS } from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface CreditBalance {
  credits: number;
  plan: SubscriptionPlan;
  monthlyAllowance: number;
  renewedAt: Date | null;
}

/**
 * Gère les crédits IA par boutique : quota mensuel selon le plan + consommation.
 * Le renouvellement est « paresseux » (appliqué à la lecture, pas de cron).
 */
@Injectable()
export class CreditsService {
  constructor(private readonly prisma: PrismaService) {}

  private isSameMonth(a: Date, b: Date): boolean {
    return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
  }

  /** Renvoie le solde à jour (renouvelle le quota si un nouveau mois a commencé). */
  async getBalance(userId: string): Promise<CreditBalance> {
    const shop = await this.prisma.shop.findUnique({
      where: { ownerId: userId },
      include: { subscription: true },
    });
    if (!shop) throw new ForbiddenException('Vous devez d’abord créer une boutique.');

    const plan = shop.subscription?.plan ?? SubscriptionPlan.STARTER;
    const allowance = PLAN_AI_CREDITS[plan] ?? PLAN_AI_CREDITS[SubscriptionPlan.STARTER];
    const now = new Date();

    // Renouvellement mensuel du quota
    if (!shop.creditsRenewedAt || !this.isSameMonth(shop.creditsRenewedAt, now)) {
      const updated = await this.prisma.shop.update({
        where: { id: shop.id },
        data: { aiCredits: allowance, creditsRenewedAt: now },
      });
      return { credits: updated.aiCredits, plan, monthlyAllowance: allowance, renewedAt: now };
    }

    return { credits: shop.aiCredits, plan, monthlyAllowance: allowance, renewedAt: shop.creditsRenewedAt };
  }

  /** Vérifie que le solde couvre `amount` (403 sinon), SANS débiter. À appeler avant une génération payante. */
  async ensure(userId: string, amount: number): Promise<void> {
    if (amount <= 0) return;
    const balance = await this.getBalance(userId);
    if (balance.credits < amount) {
      throw new ForbiddenException(
        `Crédits IA épuisés (${balance.credits}/${balance.monthlyAllowance} — plan ${balance.plan}). ` +
          `Rechargez ou passez à une offre supérieure pour continuer à générer.`,
      );
    }
  }

  /** Débite `amount` crédits, ou lève une 403 explicite si le solde est insuffisant. */
  async consume(userId: string, amount: number): Promise<number> {
    if (amount <= 0) return (await this.getBalance(userId)).credits;
    const balance = await this.getBalance(userId);
    if (balance.credits < amount) {
      throw new ForbiddenException(
        `Crédits IA épuisés (${balance.credits}/${balance.monthlyAllowance} — plan ${balance.plan}). ` +
          `Passez à une offre supérieure pour continuer à générer.`,
      );
    }
    const shop = await this.prisma.shop.update({
      where: { ownerId: userId },
      data: { aiCredits: { decrement: amount } },
    });
    return shop.aiCredits;
  }
}
