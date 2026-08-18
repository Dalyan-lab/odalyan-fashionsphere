import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/**
 * Règles d'exploration.
 *
 * Le tableau de bord, l'administration et les pages de compte sont exclus :
 * ce sont des espaces privés, sans intérêt pour un moteur de recherche, et
 * les laisser explorer gaspillerait le budget d'exploration du site.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/admin/', '/orders', '/cart', '/auth/', '/payment/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
