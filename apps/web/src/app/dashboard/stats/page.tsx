'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { convertAndFormat, useLocale, useT } from '@/lib/i18n';
import { Topbar } from '@/components/dashboard/topbar';
import { Icon } from '@/components/dashboard/icons';

interface Stats {
  revenue: number;
  ordersCount: number;
  paidOrdersCount: number;
  productsCount: number;
  customersCount: number;
  aov: number;
  conversionRate: number;
  topProducts: { name: string; sold: number; revenue: number }[];
  monthlyRevenue: { label: string; revenue: number }[];
}

export default function StatsPage() {
  const t = useT();
  const currency = useLocale((s) => s.currency);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [noShop, setNoShop] = useState(false);

  useEffect(() => {
    apiFetch<Stats>('/shops/me/stats')
      .then(setStats)
      .catch(() => setNoShop(true))
      .finally(() => setLoading(false));
  }, []);

  const fmt = (eur: number) => convertAndFormat(eur, 'EUR', currency);

  return (
    <>
      <Topbar />
      <div className="p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-violet-magenta text-white">
            {Icon.stats({})}
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold">{t('dash.nav.stats')}</h1>
            <p className="text-muted">{t('st.subtitle')}</p>
          </div>
        </div>

        {noShop ? (
          <div className="card mt-6 p-10 text-center text-muted">
            {t('common.mustCreateShop')}
            <Link href="/dashboard" className="btn-primary mx-auto mt-4 block w-fit">{t('dh.createShop')}</Link>
          </div>
        ) : loading || !stats ? (
          <p className="mt-6 text-muted">{t('common.loading')}</p>
        ) : (
          <>
            {/* KPIs */}
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Kpi icon="stats" label={t('st.revenue')} value={fmt(stats.revenue)} />
              <Kpi icon="orders" label={t('st.paidOrders')} value={`${stats.paidOrdersCount}/${stats.ordersCount}`} />
              <Kpi icon="marketing" label={t('st.aov')} value={fmt(stats.aov)} />
              <Kpi icon="clients" label={t('dash.nav.clients')} value={String(stats.customersCount)} />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {/* Revenus par mois */}
              <div className="card p-5">
                <h2 className="mb-4 font-bold">{t('st.monthlyRevenue')}</h2>
                <MonthlyChart data={stats.monthlyRevenue} fmt={fmt} />
              </div>

              {/* Conversion + trafic */}
              <div className="card p-5">
                <h2 className="mb-4 font-bold">{t('st.conversion')}</h2>
                <div className="flex items-center gap-6">
                  <Gauge value={stats.conversionRate} />
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-display text-2xl font-bold text-brand-violet">
                        {stats.conversionRate.toFixed(1)}%
                      </span>
                      <span className="ml-2 text-muted">{t('st.paidOrdersLabel')}</span>
                    </p>
                    <p className="text-muted">{stats.paidOrdersCount} {t('st.paidOnTotal')} {stats.ordersCount} {t('st.ordersWord')}</p>
                    <p className="text-xs text-faint">
                      {t('st.traffic')} <span className="text-muted">{t('st.trafficSoon')}</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Top produits */}
            <div className="card mt-6 p-5">
              <h2 className="mb-3 font-bold">{t('st.topProducts')}</h2>
              {stats.topProducts.length === 0 ? (
                <p className="text-sm text-muted">{t('st.noSales')}</p>
              ) : (
                <div className="space-y-2">
                  {stats.topProducts.map((p, i) => {
                    const max = stats.topProducts[0]!.revenue || 1;
                    return (
                      <div key={p.name} className="flex items-center gap-3">
                        <span className="w-5 text-sm font-bold text-faint">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="truncate">{p.name}</span>
                            <span className="ml-2 shrink-0 font-semibold text-brand-violet">{fmt(p.revenue)}</span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-surface-2">
                            <div
                              className="h-full rounded-full bg-brand-violet-magenta"
                              style={{ width: `${Math.max(6, (p.revenue / max) * 100)}%` }}
                            />
                          </div>
                          <p className="mt-0.5 text-[10px] text-faint">{p.sold} {t('st.sold')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Kpi({ icon, label, value }: { icon: keyof typeof Icon; label: string; value: string }) {
  return (
    <div className="card p-4">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-2 text-brand-violet">
        {Icon[icon]({ width: 18, height: 18 })}
      </span>
      <p className="mt-3 font-display text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function MonthlyChart({ data, fmt }: { data: { label: string; revenue: number }[]; fmt: (n: number) => string }) {
  const max = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <div className="flex h-40 items-end justify-between gap-2">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] text-faint">{d.revenue > 0 ? fmt(d.revenue) : ''}</span>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-lg bg-brand-violet-magenta transition-all"
              style={{ height: `${Math.max(2, (d.revenue / max) * 100)}%` }}
            />
          </div>
          <span className="text-xs capitalize text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function Gauge({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      className="grid h-24 w-24 shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(var(--brand-violet) ${pct * 3.6}deg, var(--surface-2) 0deg)` }}
    >
      <div className="grid h-16 w-16 place-items-center rounded-full bg-surface text-sm font-bold">
        {pct.toFixed(0)}%
      </div>
    </div>
  );
}
