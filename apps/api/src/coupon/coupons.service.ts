import { BadRequestException, Injectable } from '@nestjs/common';
import { Coupon, Prisma } from '@prisma/client';
import type { CouponPreview, CreateCouponInput } from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Remise en EUR appliquée par un coupon sur un montant de base (plafonnée au montant). */
  static discountFor(coupon: Coupon, baseEur: number): number {
    let off = 0;
    if (coupon.percentOff) off = (baseEur * coupon.percentOff) / 100;
    else if (coupon.amountOffEur) off = Number(coupon.amountOffEur);
    return Math.min(baseEur, Math.round(off * 100) / 100);
  }

  private label(coupon: Coupon): string {
    return coupon.percentOff ? `-${coupon.percentOff}%` : `-${Number(coupon.amountOffEur)} €`;
  }

  /**
   * Vérifie qu'un coupon est utilisable par une boutique pour un contexte donné.
   * Renvoie le coupon si valide, sinon une raison textuelle (jamais d'exception ici :
   * l'appelant décide quoi en faire — aperçu ou application).
   */
  async check(
    code: string,
    shopId: string,
    scope: 'credits' | 'order',
  ): Promise<{ coupon: Coupon } | { reason: string }> {
    const coupon = await this.prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!coupon || !coupon.active) return { reason: 'Code promo invalide.' };
    if (coupon.appliesTo !== 'all' && coupon.appliesTo !== scope) {
      return { reason: 'Ce code ne s’applique pas à cet achat.' };
    }
    if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) return { reason: 'Ce code a expiré.' };
    if (coupon.maxRedemptions != null && coupon.timesRedeemed >= coupon.maxRedemptions) {
      return { reason: 'Ce code a atteint sa limite d’utilisation.' };
    }
    const already = await this.prisma.couponRedemption.findUnique({
      where: { couponId_shopId: { couponId: coupon.id, shopId } },
    });
    if (already) return { reason: 'Vous avez déjà utilisé ce code.' };
    return { coupon };
  }

  /** Aperçu de la remise pour l'UI (montant de base → montant final). */
  async preview(code: string, shopId: string, baseEur: number, scope: 'credits' | 'order'): Promise<CouponPreview> {
    const res = await this.check(code, shopId, scope);
    if ('reason' in res) return { code: code.trim().toUpperCase(), valid: false, reason: res.reason };
    const discountEur = CouponsService.discountFor(res.coupon, baseEur);
    return {
      code: res.coupon.code,
      valid: true,
      originalEur: baseEur,
      discountEur,
      finalEur: Math.max(0, Math.round((baseEur - discountEur) * 100) / 100),
      label: this.label(res.coupon),
    };
  }

  /**
   * Enregistre l'utilisation d'un coupon (idempotent par boutique via contrainte unique).
   * Appelé APRÈS confirmation de paiement. N'échoue jamais le flux de paiement.
   */
  async redeem(code: string, shopId: string, context: string, amountOffEur: number): Promise<void> {
    const coupon = await this.prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!coupon) return;
    try {
      await this.prisma.$transaction([
        this.prisma.couponRedemption.create({
          data: { couponId: coupon.id, shopId, context, amountOffEur: new Prisma.Decimal(amountOffEur) },
        }),
        this.prisma.coupon.update({ where: { id: coupon.id }, data: { timesRedeemed: { increment: 1 } } }),
      ]);
    } catch {
      // Déjà enregistré (contrainte unique couponId+shopId) — idempotent, on ignore.
    }
  }

  // ------------------------------------------------------------------ Admin

  async create(input: CreateCouponInput): Promise<Coupon> {
    const code = input.code.trim().toUpperCase();
    const exists = await this.prisma.coupon.findUnique({ where: { code } });
    if (exists) throw new BadRequestException('Un coupon avec ce code existe déjà.');
    return this.prisma.coupon.create({
      data: {
        code,
        description: input.description,
        percentOff: input.percentOff,
        amountOffEur: input.amountOffEur != null ? new Prisma.Decimal(input.amountOffEur) : null,
        appliesTo: input.appliesTo,
        maxRedemptions: input.maxRedemptions,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });
  }

  async list(): Promise<Coupon[]> {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async setActive(id: string, active: boolean): Promise<Coupon> {
    return this.prisma.coupon.update({ where: { id }, data: { active } });
  }
}
