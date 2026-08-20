import type { Metadata } from 'next';

/**
 * Métadonnées dans un layout : la page d'aide est un composant client — elle
 * déplie ses questions — et un composant client ne peut pas les exporter.
 */
export const metadata: Metadata = {
  title: 'Centre d’aide',
  description:
    'Comment acheter, comment vendre, et comment fonctionne l’argent sur Odalyan FashionSphere : livraison, remboursements, commission et versements.',
};

export default function AideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
