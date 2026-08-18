import type { Metadata } from 'next';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fashodalyansp.com';

/**
 * Lecture publique côté serveur, pour les métadonnées.
 *
 * Ne passe pas par `apiFetch` : celui-ci vit dans le navigateur, gère les
 * jetons et redirige vers la connexion en cas d'échec. Ici on veut une lecture
 * anonyme qui, si elle échoue, laisse simplement la page sans métadonnées
 * enrichies plutôt que de casser le rendu.
 */
async function fetchPublic<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      // Les prix et les vitrines changent : on garde une heure de cache, ce qui
      // évite d'interroger l'API à chaque partage tout en restant à jour.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface ProductSeo {
  id: string;
  name: string;
  description?: string | null;
  price: string;
  currency: string;
  images: string[];
  shop?: { name: string; slug: string } | null;
}

/** Nettoie une description pour un aperçu de partage. */
function excerpt(text: string | null | undefined, fallback: string, max = 160): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Montant lisible dans la devise de la plateforme. */
function money(amount: string, currency: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return currency === 'XOF'
    ? `${Math.round(n).toLocaleString('fr-FR')} FCFA`
    : `${n.toFixed(2)} ${currency}`;
}

/**
 * Carte de partage d'un produit.
 *
 * Le prix figure dans la description : c'est l'information qui décide du clic
 * quand un lien apparaît dans un fil TikTok ou une conversation WhatsApp.
 */
export async function productMetadata(id: string): Promise<Metadata> {
  const product = await fetchPublic<ProductSeo>(`/products/${id}`);
  if (!product) return { title: 'Produit' };

  const price = money(product.price, product.currency);
  const shop = product.shop?.name;
  const description = excerpt(
    product.description,
    `${product.name}${price ? ` — ${price}` : ''}${shop ? `, vendu par ${shop}` : ''}.`,
  );
  const url = `${SITE_URL}/product/${product.id}`;
  const images = product.images.slice(0, 1);

  return {
    title: product.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title: `${product.name}${price ? ` — ${price}` : ''}`,
      description,
      images: images.length ? images : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name}${price ? ` — ${price}` : ''}`,
      description,
      images: images.length ? images : undefined,
    },
  };
}

interface ShopSeo {
  name: string;
  slug: string;
  slogan?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
}

/** Carte de partage d'une vitrine de boutique. */
export async function shopMetadata(slug: string): Promise<Metadata> {
  const shop = await fetchPublic<ShopSeo>(`/shops/public/${slug}`);
  if (!shop) return { title: 'Boutique' };

  const description = excerpt(
    shop.description ?? shop.slogan,
    `Découvrez la boutique ${shop.name} sur Odalyan FashionSphere.`,
  );
  const url = `${SITE_URL}/shop/${shop.slug}`;
  // La bannière avant le logo : elle est au format large attendu par les
  // aperçus de partage, là où un logo carré est rogné.
  const image = shop.bannerUrl || shop.logoUrl;

  return {
    title: shop.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title: shop.name,
      description,
      images: image ? [image] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: shop.name,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export { SITE_URL, fetchPublic };
