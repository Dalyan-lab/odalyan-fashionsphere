import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Programme ViralAmazone',
  description:
    'Repérez les produits qui montent, faites-en des vidéos courtes, et gagnez sur chaque clic. Niveaux, bonus en crédits et gains retirables en francs CFA.',
};

export default function ViralAmazoneLayout({ children }: { children: React.ReactNode }) {
  return children;
}
