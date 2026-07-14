import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  CLICK_MILESTONES,
  type CreatorTier,
  LEADERBOARD_BONUS,
  STREAK_MILESTONES,
  TIER_ORDER,
  TIER_SCRIPT_COST,
  TIER_THRESHOLDS,
  TIER_UP_BONUS,
  tierForClicks,
  type CreatorProgressDto,
  type LeaderboardEntryDto,
} from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreditsService } from '../credits/credits.service';

const CLICK_DEDUP_WINDOW_MS = 30 * 60_000; // 30 min

/**
 * Système d'encouragement ViralAmazone (Couche 1) : récompense l'activité
 * mesurable en temps réel — clics via le lien traçant, régularité de
 * génération — par des crédits IA bonus. Voir doc de conception dans la
 * mémoire projet : Amazon ne fournit aucune donnée de commission en temps
 * réel, donc les vraies commissions (Couche 2) restent un chantier séparé.
 */
@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
  ) {}

  /** Coût effectif d'une génération de script pour ce niveau de vendeur. */
  scriptCostFor(tier: CreatorTier): number {
    return TIER_SCRIPT_COST[tier];
  }

  /** Hash à sens unique de l'IP (anti-abus par dédoublonnage, aucune donnée brute conservée). */
  private hashIp(ip: string): string {
    return createHash('sha256').update(ip).digest('hex');
  }

  /**
   * Enregistre un clic sur le lien traçant. Dédupliqué (même script+IP dans
   * les 30 min → ignoré). Met à jour le compteur, le niveau, et les jalons.
   */
  async recordClick(scriptId: string, ip: string): Promise<void> {
    const script = await this.prisma.viralScript.findUnique({ where: { id: scriptId }, select: { shopId: true } });
    if (!script) return;

    const ipHash = this.hashIp(ip);
    const since = new Date(Date.now() - CLICK_DEDUP_WINDOW_MS);
    const duplicate = await this.prisma.affiliateClick.findFirst({
      where: { scriptId, ipHash, createdAt: { gte: since } },
    });
    if (duplicate) return;

    await this.prisma.affiliateClick.create({ data: { shopId: script.shopId, scriptId, ipHash } });
    const shop = await this.prisma.shop.update({
      where: { id: script.shopId },
      data: { totalClicks: { increment: 1 } },
      select: { id: true, totalClicks: true, creatorTier: true },
    });

    await this.checkClickMilestones(shop.id, shop.totalClicks);
    await this.checkTierUp(shop.id, shop.totalClicks, shop.creatorTier);
  }

  /**
   * À appeler à chaque génération de script réussie : met à jour la série de
   * jours consécutifs d'activité et accorde les jalons de série franchis.
   */
  async recordActivity(shopId: string): Promise<void> {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { lastActivityDate: true, currentStreakDays: true, longestStreakDays: true },
    });
    if (!shop) return;

    const today = this.dayOnly(new Date());
    const last = shop.lastActivityDate ? this.dayOnly(shop.lastActivityDate) : null;

    let streak = shop.currentStreakDays;
    if (!last) {
      streak = 1;
    } else {
      const diffDays = Math.round((today.getTime() - last.getTime()) / 86_400_000);
      if (diffDays === 0) return; // déjà comptabilisé aujourd'hui
      streak = diffDays === 1 ? streak + 1 : 1;
    }
    const longest = Math.max(shop.longestStreakDays, streak);

    await this.prisma.shop.update({
      where: { id: shopId },
      data: { currentStreakDays: streak, longestStreakDays: longest, lastActivityDate: today },
    });

    for (const milestone of STREAK_MILESTONES) {
      if (streak >= milestone.days) {
        await this.grantOnce(shopId, 'STREAK_MILESTONE', `streak_${milestone.days}`, milestone.credits);
      }
    }
  }

  private async checkClickMilestones(shopId: string, totalClicks: number): Promise<void> {
    for (const milestone of CLICK_MILESTONES) {
      if (totalClicks >= milestone.clicks) {
        await this.grantOnce(shopId, 'CLICK_MILESTONE', `clicks_${milestone.clicks}`, milestone.credits);
      }
    }
  }

  private async checkTierUp(shopId: string, totalClicks: number, currentTier: CreatorTier): Promise<void> {
    const newTier = tierForClicks(totalClicks);
    if (newTier === currentTier) return;
    if (TIER_ORDER.indexOf(newTier) <= TIER_ORDER.indexOf(currentTier)) return;

    await this.prisma.shop.update({ where: { id: shopId }, data: { creatorTier: newTier } });
    await this.grantOnce(shopId, 'TIER_UP', `tier_${newTier}`, TIER_UP_BONUS[newTier]);
  }

  /** Accorde une récompense de façon idempotente (clé unique par boutique). */
  private async grantOnce(shopId: string, kind: string, key: string, credits: number): Promise<void> {
    try {
      await this.prisma.rewardEvent.create({ data: { shopId, kind, key, credits } });
    } catch {
      return; // déjà accordé (contrainte unique shopId+key) — idempotent, silencieux
    }
    if (credits > 0) await this.credits.grantBonus(shopId, credits);
  }

  /** Résumé de progression pour l'affichage dashboard. */
  async getProgress(shopId: string): Promise<CreatorProgressDto> {
    const shop = await this.prisma.shop.findUniqueOrThrow({
      where: { id: shopId },
      select: { totalClicks: true, currentStreakDays: true, longestStreakDays: true, creatorTier: true },
    });
    const tierIndex = TIER_ORDER.indexOf(shop.creatorTier);
    const nextTier = tierIndex < TIER_ORDER.length - 1 ? TIER_ORDER[tierIndex + 1]! : null;
    const rewards = await this.prisma.rewardEvent.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      tier: shop.creatorTier,
      totalClicks: shop.totalClicks,
      currentStreakDays: shop.currentStreakDays,
      longestStreakDays: shop.longestStreakDays,
      nextTier,
      clicksToNextTier: nextTier ? Math.max(0, TIER_THRESHOLDS[nextTier] - shop.totalClicks) : null,
      scriptCost: this.scriptCostFor(shop.creatorTier),
      recentRewards: rewards.map((r) => ({ kind: r.kind, credits: r.credits, createdAt: r.createdAt.toISOString() })),
    };
  }

  /** Classement de la semaine en cours (clics), avec le rang du vendeur courant même hors top 10. */
  async getLeaderboard(shopId: string | null): Promise<LeaderboardEntryDto[]> {
    const { start, end } = this.currentWeekRange();
    const grouped = await this.prisma.affiliateClick.groupBy({
      by: ['shopId'],
      where: { createdAt: { gte: start, lt: end } },
      _count: { shopId: true },
      orderBy: { _count: { shopId: 'desc' } },
      take: 10,
    });

    const shopIds = grouped.map((g) => g.shopId);
    const shops = await this.prisma.shop.findMany({ where: { id: { in: shopIds } }, select: { id: true, name: true } });
    const nameById = new Map(shops.map((s) => [s.id, s.name]));

    return grouped.map((g) => ({
      shopId: g.shopId,
      shopName: nameById.get(g.shopId) ?? '—',
      clicks: g._count.shopId,
      isMe: g.shopId === shopId,
    }));
  }

  private dayOnly(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  private currentWeekRange(): { start: Date; end: Date } {
    const now = new Date();
    const day = now.getUTCDay() || 7; // lundi=1 … dimanche=7
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day + 1));
    const end = new Date(start.getTime() + 7 * 86_400_000);
    return { start, end };
  }

  private previousWeekRange(): { start: Date; end: Date; label: string } {
    const { start: thisWeekStart } = this.currentWeekRange();
    const start = new Date(thisWeekStart.getTime() - 7 * 86_400_000);
    const end = thisWeekStart;
    const label = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(start.getUTCDate()).padStart(2, '0')}`;
    return { start, end, label };
  }

  /** Récompense le top 3 de la semaine écoulée — s'exécute chaque lundi à 00h05 UTC. */
  @Cron('5 0 * * 1')
  async awardWeeklyLeaderboard(): Promise<void> {
    const { start, end, label } = this.previousWeekRange();
    const grouped = await this.prisma.affiliateClick.groupBy({
      by: ['shopId'],
      where: { createdAt: { gte: start, lt: end } },
      _count: { shopId: true },
      orderBy: { _count: { shopId: 'desc' } },
      take: 3,
    });
    if (grouped.length === 0) return;

    this.logger.log(`ViralAmazone : classement hebdo ${label} — ${grouped.length} boutique(s) récompensée(s)`);
    for (let rank = 0; rank < grouped.length; rank++) {
      const bonus = LEADERBOARD_BONUS[rank] ?? 0;
      await this.grantOnce(grouped[rank]!.shopId, 'LEADERBOARD', `leaderboard_${label}_top${rank + 1}`, bonus);
    }
  }
}
