import type { Metadata } from 'next';
import { productMetadata } from '@/lib/seo';

/**
 * Métadonnées de partage de la fiche produit.
 *
 * Posées dans un `layout` plutôt que dans la page : la page est un composant
 * client — elle gère les variantes, la galerie et le panier — et ne peut donc
 * pas exporter `generateMetadata`. Le layout reçoit les mêmes paramètres et
 * s'exécute côté serveur, ce qui évite de découper la page en deux.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return productMetadata(id);
}

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
