'use client';

import { use } from 'react';
import Link from 'next/link';
import { useT } from '@/lib/i18n';
import { Topbar } from '@/components/dashboard/topbar';
import { Icon } from '@/components/dashboard/icons';

/**
 * Catch-all : filet de sécurité pour les URLs du dashboard qui n'existent pas
 * (toutes les sections réelles ont désormais leur propre page).
 */
export default function DashboardSectionPage({ params }: { params: Promise<{ rest: string[] }> }) {
  const { rest } = use(params);
  const t = useT();
  const key = rest?.[0] ?? '';
  const title = key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Section';

  return (
    <>
      <Topbar />
      <div className="grid min-h-[70vh] place-items-center p-6 text-center">
        <div className="max-w-md">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-violet-magenta text-white">
            {Icon.sparkles({ width: 30, height: 30 })}
          </div>
          <span className="mt-6 inline-block rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-bold text-brand-violet">
            🔒 {t('common.soon')}
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold">{title}</h1>
          <p className="mt-3 text-muted">{t('rest.sectionSoon')}</p>
          <Link href="/dashboard" className="btn-primary mt-8">
            {t('rest.back')}
          </Link>
        </div>
      </div>
    </>
  );
}
