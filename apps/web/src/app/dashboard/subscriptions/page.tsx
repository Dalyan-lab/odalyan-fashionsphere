'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Shop } from '@/lib/types';
import { Topbar } from '@/components/dashboard/topbar';
import { Icon } from '@/components/dashboard/icons';

const PLANS = [
  { id: 'STARTER', name: 'Starter', price: 'Gratuit', items: ['Boutique simple', '50 produits', 'Logo & slogan'], highlight: false },
  { id: 'PRO', name: 'Pro', price: '15€/mois', items: ['Produits illimités', 'Mannequin & Avatar IA', 'Photos IA'], highlight: true },
  { id: 'BUSINESS', name: 'Business', price: '49€/mois', items: ['Avatar 3D', 'Défilé 3D', 'Essayage virtuel', 'Publicités IA'], highlight: false },
  { id: 'ENTERPRISE', name: 'Enterprise', price: '199€/mois', items: ['White Label', 'Domaine perso', 'API complète', 'IA dédiée'], highlight: false },
];

const PRODUCT_LIMITS: Record<string, number | null> = {
  STARTER: 50,
  PRO: null,
  BUSINESS: null,
  ENTERPRISE: null,
};

export default function SubscriptionsPage() {
  const t = useT();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Shop | null>('/shops/me')
      .then((s) => setShop(s ?? null))
      .catch(() => setShop(null))
      .finally(() => setLoading(false));
  }, []);

  const plan = shop?.subscription?.plan ?? 'STARTER';
  const limit = PRODUCT_LIMITS[plan] ?? null;
  const used = shop?._count?.products ?? 0;

  return (
    <>
      <Topbar />
      <div className="p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-violet-magenta text-white">
            {Icon.subscriptions({})}
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold">{t('dash.nav.subscriptions')}</h1>
            <p className="text-muted">{t('sub.subtitle')}</p>
          </div>
        </div>

        {loading ? (
          <p className="mt-6 text-muted">{t('common.loading')}</p>
        ) : !shop ? (
          <div className="card mt-6 p-10 text-center text-muted">
            {t('common.mustCreateShop')}
            <Link href="/dashboard" className="btn-primary mx-auto mt-4 block w-fit">{t('dh.createShop')}</Link>
          </div>
        ) : (
          <>
            {/* Plan actuel */}
            <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
              <div>
                <p className="text-xs text-faint">{t('sub.current')}</p>
                <p className="mt-1 font-display text-3xl font-bold text-brand-violet">{plan}</p>
              </div>
              <div className="min-w-[220px] flex-1 sm:max-w-xs">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{t('sub.productsUsed')}</span>
                  <span className="font-semibold">
                    {used} / {limit === null ? t('sub.unlimited') : limit}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-brand-violet-magenta"
                    style={{ width: limit === null ? '8%' : `${Math.min(100, (used / limit) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Offres */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {PLANS.map((p) => {
                const isCurrent = p.id === plan;
                return (
                  <div
                    key={p.id}
                    className={`card relative p-5 ${p.highlight && !isCurrent ? 'border-brand-violet/50' : ''} ${
                      isCurrent ? 'border-brand-violet ring-1 ring-brand-violet/40' : ''
                    }`}
                  >
                    {isCurrent && (
                      <span className="absolute right-3 top-3 rounded-full bg-brand-violet-magenta px-2 py-0.5 text-[10px] font-bold text-white">
                        {t('sub.yourPlan')}
                      </span>
                    )}
                    <h2 className="font-display text-xl font-bold">{p.name}</h2>
                    <p className="mt-1 text-2xl font-bold text-brand-violet">{p.price}</p>
                    <ul className="mt-4 space-y-2 text-sm text-muted">
                      {p.items.map((it) => (
                        <li key={it} className="flex items-start gap-2">
                          <span className="text-emerald-500">✓</span> {it}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            <div className="card mt-6 flex flex-wrap items-center justify-between gap-3 p-5">
              <p className="text-sm text-muted">{t('sub.upgradeSoon')}</p>
              <a href="mailto:fashodalyansp@gmail.com?subject=Changement%20d%27abonnement%20Odalyan" className="btn-primary">
                {t('sub.contact')}
              </a>
            </div>
          </>
        )}
      </div>
    </>
  );
}
