import type { Metadata } from 'next';
import { shopMetadata } from '@/lib/seo';

/**
 * Métadonnées de partage de la vitrine d'un vendeur.
 *
 * Même raison que pour la fiche produit : la page est un composant client,
 * seul un layout peut porter `generateMetadata`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return shopMetadata(slug);
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
