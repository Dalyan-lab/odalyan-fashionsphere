import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Marketplace',
  description:
    'Mode, maison, beauté, high-tech, enfants et loisirs : découvrez les produits de toutes les boutiques Odalyan FashionSphere.',
  alternates: { canonical: '/marketplace' },
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
