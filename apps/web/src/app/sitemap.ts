import type { MetadataRoute } from 'next';
import { SITE_URL, fetchPublic } from '@/lib/seo';

/**
 * Plan du site, alimenté par le catalogue réel.
 *
 * Sans lui, Google ne découvre les fiches produit qu'en suivant des liens
 * depuis la marketplace — donc lentement, et jamais pour un produit récent.
 *
 * Si l'API est injoignable au moment de la génération, on renvoie les pages
 * fixes plutôt que rien : un plan partiel vaut mieux qu'une erreur.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/marketplace`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/conditions`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/confidentialite`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];

  const products = await fetchPublic<{ items: { id: string; updatedAt?: string }[] }>(
    '/products?pageSize=60',
  );

  const productPages: MetadataRoute.Sitemap = (products?.items ?? []).map((p) => ({
    url: `${SITE_URL}/product/${p.id}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticPages, ...productPages];
}
