import { Injectable, Logger } from '@nestjs/common';
import { AMAZON_MARKETPLACES } from '@odalyan/shared';

/** ID de domaine Keepa par marketplace (documentation Keepa). */
const KEEPA_DOMAIN_BY_CODE: Record<string, number> = {
  COM: 1,
  UK: 2,
  DE: 3,
  FR: 4,
  JP: 5,
  CA: 6,
  IT: 8,
  ES: 9,
  IN: 10,
};

/** Offset Keepa Time (minutes) → epoch Unix. Constante documentée par Keepa (2011-01-01 UTC). */
const KEEPA_EPOCH_MINUTES = 21_564_000;

export interface KeepaRankPoint {
  timestamp: number; // ms epoch Unix
  rank: number;
}

export interface KeepaProduct {
  asin: string;
  title: string;
  imageUrl: string | null;
  category: string | null;
  currentRank: number | null;
  history: KeepaRankPoint[]; // historique complet du rang de vente
}

/**
 * Client Keepa (fournisseur licencié spécialisé dans l'historique de prix/rang Amazon).
 * Résout légalement le besoin d'historique de vélocité — aucun scraping côté plateforme,
 * Keepa porte la charge de collecte et de conformité.
 * Inerte tant que KEEPA_API_KEY n'est pas configurée.
 */
@Injectable()
export class KeepaProvider {
  private readonly logger = new Logger(KeepaProvider.name);
  private readonly base = 'https://api.keepa.com';

  get enabled(): boolean {
    return Boolean(process.env.KEEPA_API_KEY);
  }

  private domainId(marketplaceDomain: string): number | null {
    const info = AMAZON_MARKETPLACES.find((m) => m.domain === marketplaceDomain);
    if (!info) return null;
    return KEEPA_DOMAIN_BY_CODE[info.code] ?? null;
  }

  /** Récupère jusqu'à 100 ASIN avec leur historique de rang de vente complet. */
  async getProducts(asins: string[], marketplaceDomain: string): Promise<KeepaProduct[]> {
    if (!this.enabled || asins.length === 0) return [];
    const domain = this.domainId(marketplaceDomain);
    if (domain === null) return [];

    try {
      const url = new URL('/product', this.base);
      url.searchParams.set('key', process.env.KEEPA_API_KEY!);
      url.searchParams.set('domain', String(domain));
      url.searchParams.set('asin', asins.slice(0, 100).join(','));
      url.searchParams.set('history', '1');

      const res = await fetch(url.toString());
      if (!res.ok) {
        this.logger.error(`Keepa /product ${res.status}: ${await res.text().catch(() => '')}`);
        return [];
      }
      const data = (await res.json()) as { products?: Record<string, unknown>[] };
      return (data.products ?? []).map((p) => this.mapProduct(p));
    } catch (err) {
      this.logger.error(`Keepa erreur: ${String(err)}`);
      return [];
    }
  }

  private mapProduct(p: Record<string, unknown>): KeepaProduct {
    const csv = p.csv as (number[] | null)[] | undefined;
    const salesRankSeries = csv?.[3] ?? [];
    const history: KeepaRankPoint[] = [];
    for (let i = 0; i + 1 < salesRankSeries.length; i += 2) {
      const rank = salesRankSeries[i + 1];
      if (rank === -1 || rank == null) continue;
      history.push({ timestamp: (salesRankSeries[i] + KEEPA_EPOCH_MINUTES) * 60_000, rank });
    }

    const images = p.imagesCSV as string | undefined;
    const firstImage = images?.split(',')[0];

    return {
      asin: String(p.asin ?? ''),
      title: String(p.title ?? ''),
      imageUrl: firstImage ? `https://m.media-amazon.com/images/I/${firstImage}` : null,
      category: (p.productGroup as string) ?? null,
      currentRank: history.length ? history[history.length - 1]!.rank : null,
      history,
    };
  }

  /** Rang le plus proche (à défaut, juste avant) d'un instant donné dans l'historique. */
  static rankNear(history: KeepaRankPoint[], atMs: number): number | null {
    let best: KeepaRankPoint | null = null;
    for (const point of history) {
      if (point.timestamp <= atMs && (!best || point.timestamp > best.timestamp)) best = point;
    }
    return best?.rank ?? null;
  }
}
