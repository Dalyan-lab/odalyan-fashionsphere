import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, TrendTier } from '@prisma/client';
import { AMAZON_MARKETPLACES, type ListTrendsQuery } from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PaapiProvider } from './providers/paapi.provider';
import { KeepaProvider } from './providers/keepa.provider';

/**
 * Analyseur de vélocité ("Hot Products") : calcule la progression du rang de
 * vente et classe les produits Amazon suivis. Rappel : en rang de vente Amazon,
 * PLUS LE RANG EST BAS, MEILLEURE EST LA VENTE (#1 = best-seller absolu).
 * Une vélocité positive signifie donc que le rang a BAISSÉ dans le temps.
 */
@Injectable()
export class TrendsService {
  private readonly logger = new Logger(TrendsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paapi: PaapiProvider,
    private readonly keepa: KeepaProvider,
  ) {}

  /** Vrai si au moins une source de données réelle (PA-API ou Keepa) est configurée. */
  get enabled(): boolean {
    return this.keepa.enabled || AMAZON_MARKETPLACES.some((m) => this.paapi.enabledFor(m.domain));
  }

  /**
   * Vélocité en % entre deux rangs de vente, signée pour qu'une progression
   * (rang qui baisse) donne une valeur POSITIVE. Renvoie null si la donnée
   * de référence est absente ou nulle (division impossible).
   */
  static computeVelocity(rankNow: number | null, rankBefore: number | null): number | null {
    if (rankNow == null || rankBefore == null || rankBefore <= 0) return null;
    return ((rankBefore - rankNow) / rankBefore) * 100;
  }

  /**
   * Classe un produit selon les seuils du document de spécification.
   * Le tracker capture des fenêtres 3h/12h/24h (pas 3 jours) : Hot Wood est donc
   * approximé par une croissance 24h soutenue plutôt qu'une vraie fenêtre de 3 jours.
   */
  static classify(velocity12h: number | null, velocity24h: number | null): TrendTier | null {
    if (velocity12h != null && velocity12h > 200) return TrendTier.SUPER_NOVA;
    if (velocity24h != null && velocity24h > 30) return TrendTier.HOT_WOOD;
    if (velocity24h != null && velocity24h > 0) return TrendTier.SLOW_BURN;
    return null;
  }

  /** Liste paginée des produits suivis, triée par vélocité 24h décroissante. */
  async listTrends(query: ListTrendsQuery) {
    const where: Prisma.AmazonProductWhereInput = {
      ...(query.marketplace ? { marketplace: query.marketplace } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.tier ? { trendTier: query.tier as TrendTier } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.amazonProduct.findMany({
        where,
        orderBy: [{ velocity24h: 'desc' }, { updatedAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.amazonProduct.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  /**
   * Ajoute (ou reconnecte) un ASIN au tracker — curation manuelle (admin/vendeur).
   * Récupère l'état initial via PA-API/Keepa si disponible, sinon crée un
   * enregistrement minimal complété au prochain cycle de rafraîchissement.
   */
  async trackAsin(asin: string, marketplaceDomain: string) {
    const existing = await this.prisma.amazonProduct.findUnique({
      where: { asin_marketplace: { asin, marketplace: marketplaceDomain } },
    });
    if (existing) return existing;

    const product = await this.prisma.amazonProduct.create({
      data: {
        asin,
        marketplace: marketplaceDomain,
        title: asin,
        productUrl: `https://www.${marketplaceDomain}/dp/${asin}`,
      },
    });
    await this.refreshOne(product.id).catch((err) =>
      this.logger.error(`Rafraîchissement initial échoué (${asin}): ${String(err)}`),
    );
    return this.prisma.amazonProduct.findUnique({ where: { id: product.id } });
  }

  /** Retire un produit du tracker (curation admin) — supprime aussi son historique et ses scripts liés. */
  async untrackProduct(productId: string): Promise<{ deleted: boolean }> {
    await this.prisma.amazonProduct.delete({ where: { id: productId } }).catch(() => null);
    return { deleted: true };
  }

  /** Rafraîchit un produit : nouvel état PA-API + snapshot + recalcul de vélocité. */
  async refreshOne(productId: string): Promise<void> {
    const product = await this.prisma.amazonProduct.findUnique({ where: { id: productId } });
    if (!product) return;

    const [paapiItems, keepaProducts] = await Promise.all([
      this.paapi.enabledFor(product.marketplace) ? this.paapi.getItems([product.asin], product.marketplace) : [],
      this.keepa.enabled ? this.keepa.getProducts([product.asin], product.marketplace) : [],
    ]);
    const fresh = paapiItems[0];
    const historic = keepaProducts[0];

    const currentRank = fresh?.salesRank ?? historic?.currentRank ?? product.currentRank ?? null;
    const now = new Date();

    if (currentRank != null) {
      await this.prisma.amazonRankSnapshot.create({
        data: {
          productId: product.id,
          salesRank: currentRank,
          price: fresh?.price != null ? new Prisma.Decimal(fresh.price) : undefined,
          reviewCount: fresh?.reviewCount ?? undefined,
          rating: fresh?.rating != null ? new Prisma.Decimal(fresh.rating) : undefined,
          capturedAt: now,
        },
      });
    }

    const rank3h = await this.rankBefore(product.id, historic?.history ?? [], now, 3);
    const rank12h = await this.rankBefore(product.id, historic?.history ?? [], now, 12);
    const rank24h = await this.rankBefore(product.id, historic?.history ?? [], now, 24);

    const velocity3h = TrendsService.computeVelocity(currentRank, rank3h);
    const velocity12h = TrendsService.computeVelocity(currentRank, rank12h);
    const velocity24h = TrendsService.computeVelocity(currentRank, rank24h);
    const trendTier = TrendsService.classify(velocity12h, velocity24h);

    await this.prisma.amazonProduct.update({
      where: { id: product.id },
      data: {
        title: fresh?.title || historic?.title || product.title,
        imageUrl: fresh?.imageUrl ?? historic?.imageUrl ?? product.imageUrl,
        category: fresh?.category ?? historic?.category ?? product.category,
        productUrl: fresh?.productUrl ?? product.productUrl,
        currentRank: currentRank ?? undefined,
        currentPrice: fresh?.price != null ? new Prisma.Decimal(fresh.price) : undefined,
        currency: fresh?.currency ?? undefined,
        reviewCount: fresh?.reviewCount ?? undefined,
        rating: fresh?.rating != null ? new Prisma.Decimal(fresh.rating) : undefined,
        velocity3h: velocity3h ?? undefined,
        velocity12h: velocity12h ?? undefined,
        velocity24h: velocity24h ?? undefined,
        trendTier: trendTier ?? undefined,
        lastCheckedAt: now,
      },
    });
  }

  /** Rang de référence il y a `hoursAgo` heures : Keepa d'abord, sinon nos propres relevés. */
  private async rankBefore(
    productId: string,
    keepaHistory: { timestamp: number; rank: number }[],
    now: Date,
    hoursAgo: number,
  ): Promise<number | null> {
    const target = now.getTime() - hoursAgo * 3_600_000;
    if (keepaHistory.length) {
      const rank = KeepaProvider.rankNear(keepaHistory, target);
      if (rank != null) return rank;
    }
    const snapshot = await this.prisma.amazonRankSnapshot.findFirst({
      where: { productId, capturedAt: { lte: new Date(target) } },
      orderBy: { capturedAt: 'desc' },
    });
    return snapshot?.salesRank ?? null;
  }

  /** Rafraîchit tous les produits suivis (toutes les 3h). Sans effet si aucune source n'est active. */
  @Cron(CronExpression.EVERY_3_HOURS)
  async refreshAll(): Promise<void> {
    if (!this.enabled) return;
    const products = await this.prisma.amazonProduct.findMany({ select: { id: true } });
    this.logger.log(`ViralAmazone : rafraîchissement de ${products.length} produit(s) suivi(s)`);
    for (const p of products) {
      await this.refreshOne(p.id).catch((err) => this.logger.error(`Rafraîchissement échoué (${p.id}): ${String(err)}`));
    }
  }
}
