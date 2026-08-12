'use client';

import Link from 'next/link';
import { useT } from '@/lib/i18n';

/**
 * Message affiché par l'essayage virtuel et le défilé quand aucun article de
 * mode n'est disponible.
 *
 * Distingue deux situations très différentes : la boutique est vide, ou elle
 * contient des produits mais aucun de mode. Dans le second cas, dire « aucun
 * produit » serait faux et déroutant — on oriente vers le studio photo produit,
 * qui est l'équivalent pour les autres rayons.
 */
export function NoFashionProducts({ hasOtherProducts }: { hasOtherProducts: boolean }) {
  const t = useT();

  if (!hasOtherProducts) {
    return (
      <p className="text-sm text-muted">
        {t('common.noProducts')}{' '}
        <Link href="/dashboard/products" className="text-brand-violet hover:underline">
          {t('common.addOne')}
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <p className="text-sm">👗 {t('fashionOnly.title')}</p>
      <p className="mt-1 text-xs text-muted">{t('fashionOnly.hint')}</p>
      <Link href="/dashboard/studio" className="btn-primary mt-3 inline-block text-xs">
        📦 {t('fashionOnly.cta')}
      </Link>
    </div>
  );
}
