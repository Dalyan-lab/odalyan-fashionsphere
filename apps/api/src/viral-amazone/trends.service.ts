import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, TrendTier } from '@prisma/client';
import { AMAZON_MARKETPLACES, type ListTrendsQuery } from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PaapiProvider } from './providers/paapi.provider';
import { KeepaProvider } from './providers/keepa.provider';

/** Métadonnées de curation manuelle d'un produit (avant que PA-API ne les fournisse). */
export interface TrackMeta {
  title?: string;
  imageUrl?: string;
  category?: string;
  price?: number;
  currency?: string;
}

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
  async trackAsin(asin: string, marketplaceDomain: string, meta?: TrackMeta) {
    // Métadonnées de curation (utiles tant que PA-API n'est pas branché) : titre,
    // image, catégorie, prix fournis à la main. PA-API les écrasera ensuite si actif.
    const curated = {
      ...(meta?.title ? { title: meta.title } : {}),
      ...(meta?.imageUrl ? { imageUrl: meta.imageUrl } : {}),
      ...(meta?.category ? { category: meta.category } : {}),
      ...(meta?.price != null ? { currentPrice: new Prisma.Decimal(meta.price) } : {}),
      ...(meta?.currency ? { currency: meta.currency } : {}),
    };

    const existing = await this.prisma.amazonProduct.findUnique({
      where: { asin_marketplace: { asin, marketplace: marketplaceDomain } },
    });
    if (existing) {
      // Ré-ajout avec métadonnées : on met à jour la fiche curée
      if (Object.keys(curated).length) {
        return this.prisma.amazonProduct.update({ where: { id: existing.id }, data: curated });
      }
      return existing;
    }

    const product = await this.prisma.amazonProduct.create({
      data: {
        asin,
        marketplace: marketplaceDomain,
        title: meta?.title || asin,
        productUrl: `https://www.${marketplaceDomain}/dp/${asin}`,
        ...curated,
      },
    });
    await this.refreshOne(product.id).catch((err) =>
      this.logger.error(`Rafraîchissement initial échoué (${asin}): ${String(err)}`),
    );
    return this.prisma.amazonProduct.findUnique({ where: { id: product.id } });
  }

  /** Retire un produit du tracker (curation admin) — supprime aussi son historique et ses scripts liés. */
  // ---------------------------------------------------------------------------
  // Découverte automatique des meilleures ventes
  // ---------------------------------------------------------------------------

  /** Rayons surveillés, avec le résultat de leur dernier passage. */
  async listWatches() {
    return this.prisma.trendWatch.findMany({ orderBy: { createdAt: 'asc' } });
  }

  /**
   * Déclare un rayon à surveiller.
   *
   * `category` accepte un identifiant de nœud Amazon ou un nom de groupe
   * d'affichage (« beauty »). Le couple marketplace + catégorie est unique :
   * réenregistrer le même rayon le met à jour plutôt que de le dupliquer.
   */
  async addWatch(input: {
    label: string;
    marketplace: string;
    category: string;
    topN?: number;
  }) {
    const data = {
      label: input.label.trim(),
      marketplace: input.marketplace,
      category: input.category.trim(),
      topN: Math.max(1, Math.min(50, input.topN ?? 10)),
    };
    return this.prisma.trendWatch.upsert({
      where: { marketplace_category: { marketplace: data.marketplace, category: data.category } },
      create: data,
      update: { label: data.label, topN: data.topN, active: true },
    });
  }

  async setWatchActive(id: string, active: boolean) {
    return this.prisma.trendWatch.update({ where: { id }, data: { active } });
  }

  async removeWatch(id: string): Promise<{ deleted: boolean }> {
    await this.prisma.trendWatch.delete({ where: { id } }).catch(() => undefined);
    return { deleted: true };
  }

  /**
   * Reprend le haut du classement d'un rayon et met les produits sous suivi.
   *
   * Les erreurs sont enregistrées sur le rayon plutôt que propagées : un rayon
   * mal configuré ne doit pas empêcher les autres de fonctionner, et
   * l'administrateur doit pouvoir voir lequel pose problème.
   */
  async runWatch(id: string): Promise<{ found: number; tracked: number }> {
    const watch = await this.prisma.trendWatch.findUnique({ where: { id } });
    if (!watch) return { found: 0, tracked: 0 };

    try {
      const asins = await this.keepa.bestSellers(watch.category, watch.marketplace, watch.topN);
      let tracked = 0;
      for (const asin of asins) {
        // Séquentiel volontairement : chaque ajout déclenche un appel PA-API et
        // un appel Keepa. Les paralléliser ferait tomber les quotas.
        await this.trackAsin(asin, watch.marketplace).catch((err) =>
          this.logger.warn(`Suivi impossible pour ${asin} : ${String(err)}`),
        );
        tracked += 1;
      }
      await this.prisma.trendWatch.update({
        where: { id },
        data: { lastRunAt: new Date(), lastCount: tracked, lastError: null },
      });
      return { found: asins.length, tracked };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.trendWatch.update({
        where: { id },
        data: { lastRunAt: new Date(), lastError: message },
      });
      this.logger.error(`Rayon « ${watch.label} » en échec : ${message}`);
      return { found: 0, tracked: 0 };
    }
  }

  /**
   * Passage quotidien sur tous les rayons actifs.
   *
   * Une fois par jour et non toutes les heures : un classement de meilleures
   * ventes bouge lentement, et chaque appel consomme des jetons Keepa. La
   * vélocité, elle, continue d'être recalculée toutes les 3 heures.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async discoverAll(): Promise<void> {
    if (!this.keepa.enabled) return;
    const watches = await this.prisma.trendWatch.findMany({ where: { active: true } });
    for (const w of watches) {
      await this.runWatch(w.id);
    }
    if (watches.length) this.logger.log(`Découverte terminée sur ${watches.length} rayon(s).`);
  }

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
