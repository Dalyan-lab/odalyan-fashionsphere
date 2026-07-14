import { z } from 'zod';

/**
 * Marketplaces Amazon supportés par le Tracker (PA-API + Keepa).
 * `domain` = domaine Amazon réel, utilisé pour construire les liens d'affiliation.
 */
export interface AmazonMarketplaceInfo {
  code: string;
  domain: string;
  label: string;
}

export const AMAZON_MARKETPLACES: AmazonMarketplaceInfo[] = [
  { code: 'FR', domain: 'amazon.fr', label: 'France' },
  { code: 'COM', domain: 'amazon.com', label: 'États-Unis' },
  { code: 'UK', domain: 'amazon.co.uk', label: 'Royaume-Uni' },
  { code: 'DE', domain: 'amazon.de', label: 'Allemagne' },
  { code: 'IT', domain: 'amazon.it', label: 'Italie' },
  { code: 'ES', domain: 'amazon.es', label: 'Espagne' },
  { code: 'CA', domain: 'amazon.ca', label: 'Canada' },
  { code: 'JP', domain: 'amazon.co.jp', label: 'Japon' },
  { code: 'IN', domain: 'amazon.in', label: 'Inde' },
];

export enum TrendTier {
  SUPER_NOVA = 'SUPER_NOVA', // 🔴 Explosion Éclair : progression > 200% en < 12h
  HOT_WOOD = 'HOT_WOOD', // 🔥 Tendance Forte : croissance constante sur 3 jours
  SLOW_BURN = 'SLOW_BURN', // 📈 Croissance Stable : hausse régulière + avis en hausse
}

export enum ScriptPlatform {
  TIKTOK = 'TIKTOK',
  REELS = 'REELS',
  SHORTS = 'SHORTS',
}

export const listTrendsQuerySchema = z.object({
  marketplace: z.string().optional(),
  category: z.string().optional(),
  tier: z.nativeEnum(TrendTier).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type ListTrendsQuery = z.infer<typeof listTrendsQuerySchema>;

export const generateViralScriptSchema = z.object({
  productId: z.string().min(1, 'Produit Amazon requis'),
  platform: z.nativeEnum(ScriptPlatform).default(ScriptPlatform.TIKTOK),
});

export type GenerateViralScriptInput = z.infer<typeof generateViralScriptSchema>;

export interface AmazonTrendProductDto {
  id: string;
  asin: string;
  marketplace: string;
  title: string;
  imageUrl?: string | null;
  category?: string | null;
  productUrl: string;
  currentRank?: number | null;
  currentPrice?: number | null;
  currency?: string | null;
  reviewCount?: number | null;
  rating?: number | null;
  velocity3h?: number | null;
  velocity12h?: number | null;
  velocity24h?: number | null;
  trendTier?: TrendTier | null;
  lastCheckedAt?: string | null;
}

export interface ViralScriptDto {
  id: string;
  productId: string;
  platform: ScriptPlatform;
  hook: string;
  problem: string;
  solution: string;
  cta: string;
  affiliateUrl: string;
  provider: string;
  createdAt: string;
}
