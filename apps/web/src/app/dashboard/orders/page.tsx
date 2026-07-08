'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { Topbar } from '@/components/dashboard/topbar';

interface ShopOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: string;
  currency: string;
  createdAt: string;
  customer?: { firstName: string; lastName: string; email: string };
  items: { id: string; productName: string; quantity: number }[];
  payment?: { paid: boolean } | null;
}

const STATUSES = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-yellow-500/15 text-yellow-500',
  PAID: 'bg-emerald-500/15 text-emerald-500',
  PROCESSING: 'bg-blue-500/15 text-blue-500',
  SHIPPED: 'bg-brand-violet/15 text-brand-violet',
  DELIVERED: 'bg-emerald-500/15 text-emerald-500',
  CANCELLED: 'bg-red-500/15 text-red-400',
};

export default function OrdersPage() {
  const t = useT();
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [noShop, setNoShop] = useState(false);

  const load = async () => {
    try {
      setOrders(await apiFetch<ShopOrder[]>('/orders/shop'));
      setNoShop(false);
    } catch {
      setNoShop(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await apiFetch(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }).catch(
      () => undefined,
    );
    load();
  };

  return (
    <>
      <Topbar />
      <div className="p-6">
        <h1 className="font-display text-3xl font-bold">{t('ord.title')}</h1>
        <p className="text-muted">{t('ord.subtitle')}</p>

        <div className="mt-6">
          {loading ? (
            <p className="text-muted">{t('common.loading')}</p>
          ) : noShop ? (
            <div className="card p-10 text-center text-muted">
              {t('common.mustCreateShop')}
              <Link href="/dashboard" className="btn-primary mx-auto mt-4 block w-fit">{t('dh.createShop')}</Link>
            </div>
          ) : orders.length === 0 ? (
            <div className="card p-10 text-center text-muted">{t('ord.empty')}</div>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => (
                <div key={o.id} className="card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{o.orderNumber}</p>
                      <p className="text-xs text-faint">
                        {o.customer ? `${o.customer.firstName} ${o.customer.lastName}` : t('ord.customer')} ·{' '}
                        {new Date(o.createdAt).toLocaleDateString('fr-FR')} · {o.items.length} {t('ord.items')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-display text-lg font-bold text-brand-violet">
                        {Number(o.totalAmount).toFixed(2)} {o.currency}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[o.status] ?? 'bg-surface-2'}`}>
                        {t(`os.${o.status}`)}
                      </span>
                      <select
                        className="input w-auto py-1.5 text-sm"
                        value=""
                        onChange={(e) => e.target.value && updateStatus(o.id, e.target.value)}
                      >
                        <option value="">{t('ord.change')}</option>
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{t(`os.${s}`)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
