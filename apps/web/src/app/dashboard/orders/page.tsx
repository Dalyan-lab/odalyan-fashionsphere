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
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
}

const STATUSES = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

interface Tracking {
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

/**
 * Saisie du suivi, dépliée au passage à « expédiée ».
 *
 * Rien n'est obligatoire : beaucoup de livraisons se font par coursier local,
 * sans numéro. Le transporteur seul suffit alors à rassurer l'acheteur.
 */
function TrackingForm({
  order,
  onSave,
}: {
  order: ShopOrder;
  onSave: (t: Tracking) => Promise<void> | void;
}) {
  const t = useT();
  const [carrier, setCarrier] = useState(order.carrier ?? '');
  const [trackingNumber, setNumber] = useState(order.trackingNumber ?? '');
  const [trackingUrl, setUrl] = useState(order.trackingUrl ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave({ carrier, trackingNumber, trackingUrl });
    setSaving(false);
  };

  return (
    <div className="mt-3 rounded-xl bg-surface-2 p-3">
      <p className="mb-2 text-xs text-faint">{t('ord.trackingHint')}</p>
      <div className="flex flex-wrap gap-2">
        <input
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          placeholder={t('ord.carrierPh')}
          className="input min-w-[140px] flex-1 py-1.5 text-sm"
        />
        <input
          value={trackingNumber}
          onChange={(e) => setNumber(e.target.value)}
          placeholder={t('ord.trackingPh')}
          className="input min-w-[140px] flex-1 py-1.5 text-sm"
        />
        <input
          value={trackingUrl}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('ord.trackingUrlPh')}
          className="input min-w-[180px] flex-1 py-1.5 text-sm"
        />
        <button onClick={save} disabled={saving} className="btn-primary py-1.5 text-sm disabled:opacity-40">
          {saving ? '…' : t('common.save')}
        </button>
      </div>
    </div>
  );
}

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

  const updateStatus = async (id: string, status: string, tracking?: Tracking) => {
    await apiFetch(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...tracking }),
    }).catch(() => undefined);
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

                  {(o.status === 'SHIPPED' || o.status === 'DELIVERED') && (
                    <TrackingForm order={o} onSave={(tr) => updateStatus(o.id, o.status, tr)} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
