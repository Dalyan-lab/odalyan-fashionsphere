'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { convertAndFormat, useLocale, useT } from '@/lib/i18n';
import { Topbar } from '@/components/dashboard/topbar';
import { Icon } from '@/components/dashboard/icons';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: string;
}

export default function ClientsPage() {
  const t = useT();
  const currency = useLocale((s) => s.currency);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [noShop, setNoShop] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiFetch<Customer[]>('/shops/me/customers')
      .then(setCustomers)
      .catch(() => setNoShop(true))
      .finally(() => setLoading(false));
  }, []);

  const fmt = (eur: number) => convertAndFormat(eur, 'EUR', currency);
  const filtered = customers.filter(
    (c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()),
  );
  const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);

  const initials = (c: Customer) =>
    `${c.firstName.charAt(0)}${c.lastName.charAt(0)}`.toUpperCase() || 'C';

  return (
    <>
      <Topbar />
      <div className="p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-violet-magenta text-white">
            {Icon.clients({})}
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold">{t('dash.nav.clients')}</h1>
            <p className="text-muted">{t('cli.subtitle')}</p>
          </div>
        </div>

        {noShop ? (
          <div className="card mt-6 p-10 text-center text-muted">
            {t('common.mustCreateShop')}
            <Link href="/dashboard" className="btn-primary mx-auto mt-4 block w-fit">{t('dh.createShop')}</Link>
          </div>
        ) : loading ? (
          <p className="mt-6 text-muted">{t('common.loading')}</p>
        ) : (
          <>
            {/* Stats */}
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat icon="clients" label={t('dash.nav.clients')} value={String(customers.length)} />
              <Stat icon="orders" label={t('cli.totalOrders')} value={String(customers.reduce((s, c) => s + c.ordersCount, 0))} />
              <Stat icon="stats" label={t('cli.revenue')} value={fmt(totalRevenue)} />
            </div>

            <div className="mt-6">
              <input
                placeholder={t('cli.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input max-w-sm"
              />
            </div>

            {customers.length === 0 ? (
              <div className="card mt-4 p-10 text-center text-muted">
                {t('cli.empty')}
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {filtered.map((c, i) => (
                  <div key={c.id} className="card flex flex-wrap items-center gap-4 p-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-gradient text-sm font-bold text-white">
                      {initials(c)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {c.firstName} {c.lastName}
                        {i === 0 && customers.length > 1 && (
                          <span className="ml-2 rounded-full bg-brand-violet/15 px-2 py-0.5 text-[10px] font-bold text-brand-violet">
                            {t('cli.top')}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-faint">{c.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-faint">{t('cli.orders')}</p>
                      <p className="font-semibold">{c.ordersCount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-faint">{t('cli.totalSpent')}</p>
                      <p className="font-semibold text-brand-violet">{fmt(c.totalSpent)}</p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-xs text-faint">{t('cli.lastOrder')}</p>
                      <p className="text-sm">{new Date(c.lastOrderAt).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <p className="text-center text-sm text-muted">{t('cli.noMatch')}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Stat({ icon, label, value }: { icon: keyof typeof Icon; label: string; value: string }) {
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
