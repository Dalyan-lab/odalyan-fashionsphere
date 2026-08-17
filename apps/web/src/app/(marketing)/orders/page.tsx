'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';
import { useT, convertAndFormat, useLocale } from '@/lib/i18n';

interface MyOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: string;
  currency: string;
  createdAt: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  items: { id: string; productName: string; quantity: number; unitPrice: string }[];
  payment?: { paid: boolean } | null;
  shop: {
    name: string;
    slug: string;
    logoUrl: string | null;
    deliveryDaysMin: number | null;
    deliveryDaysMax: number | null;
    deliveryNote: string | null;
  };
}

/** Étapes normales d'une commande. Annulation et remboursement sortent du fil. */
const STEPS = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-yellow-500/15 text-yellow-500',
  PAID: 'bg-emerald-500/15 text-emerald-500',
  PROCESSING: 'bg-blue-500/15 text-blue-500',
  SHIPPED: 'bg-brand-violet/15 text-brand-violet',
  DELIVERED: 'bg-emerald-500/15 text-emerald-500',
  CANCELLED: 'bg-red-500/15 text-red-400',
  REFUNDED: 'bg-red-500/15 text-red-400',
};

/**
 * Fil d'avancement de la commande.
 *
 * Montre les étapes franchies ET celles à venir : un acheteur qui voit qu'il
 * reste deux étapes patiente, là où un simple libellé de statut laisse croire
 * que rien ne bouge.
 */
function Progress({ status }: { status: string }) {
  const t = useT();
  if (status === 'CANCELLED' || status === 'REFUNDED' || status === 'PENDING') return null;
  const current = STEPS.indexOf(status as (typeof STEPS)[number]);

  return (
    <ol className="mt-4 flex items-center gap-1">
      {STEPS.map((step, i) => {
        const done = i <= current;
        return (
          <li key={step} className="flex flex-1 flex-col gap-1.5">
            <span
              className={`h-1.5 rounded-full ${done ? 'bg-brand-violet' : 'bg-surface-2'}`}
              aria-hidden
            />
            <span className={`text-[11px] ${done ? 'text-content' : 'text-faint'}`}>
              {t(`os.${step}`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Date de livraison estimée, calculée depuis le délai annoncé par la boutique. */
function EstimatedDelivery({ order }: { order: MyOrder }) {
  const t = useT();
  const { min, max } = { min: order.shop.deliveryDaysMin, max: order.shop.deliveryDaysMax };
  if (order.status === 'DELIVERED' || order.status === 'CANCELLED') return null;
  if (min == null && max == null) return null;

  // Le compte à rebours part de l'expédition si elle a eu lieu, sinon de la
  // commande : c'est la lecture la plus honnête pour l'acheteur.
  const from = order.shippedAt ? new Date(order.shippedAt) : new Date(order.createdAt);
  const day = (n: number) => {
    const d = new Date(from);
    d.setDate(d.getDate() + n);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  };

  return (
    <p className="mt-3 text-sm text-muted">
      {t('myord.estimated')}{' '}
      <strong className="text-content">
        {min != null && max != null && min !== max
          ? `${day(min)} – ${day(max)}`
          : day((max ?? min) as number)}
      </strong>
      {order.shop.deliveryNote && <span className="block text-xs text-faint">{order.shop.deliveryNote}</span>}
    </p>
  );
}

export default function MyOrdersPage() {
  const t = useT();
  const currency = useLocale((s) => s.currency);
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    apiFetch<MyOrder[]>('/orders/mine')
      .then(setOrders)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) setNeedsLogin(true);
        else setOrders([]);
      });
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-display text-4xl font-bold">{t('myord.title')}</h1>
      <p className="mt-1 text-muted">{t('myord.subtitle')}</p>

      {needsLogin ? (
        <div className="card mt-8 p-10 text-center">
          <p className="text-muted">{t('myord.loginNeeded')}</p>
          <Link href="/login" className="btn-primary mx-auto mt-4 block w-fit">
            {t('nav.login')}
          </Link>
        </div>
      ) : orders === null ? (
        <p className="mt-8 text-muted">{t('common.loading')}</p>
      ) : orders.length === 0 ? (
        <div className="card mt-8 p-10 text-center">
          <p className="text-muted">{t('myord.empty')}</p>
          <Link href="/marketplace" className="btn-primary mx-auto mt-4 block w-fit">
            {t('nav.marketplace')}
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {orders.map((o) => (
            <article key={o.id} className="card p-5">
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{o.orderNumber}</p>
                  <p className="text-xs text-faint">
                    {new Date(o.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}{' '}
                    ·{' '}
                    <Link href={`/shop/${o.shop.slug}`} className="hover:text-content">
                      {o.shop.name}
                    </Link>
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[o.status] ?? 'bg-surface-2'}`}
                >
                  {t(`os.${o.status}`)}
                </span>
              </header>

              <Progress status={o.status} />

              <ul className="mt-4 space-y-1 text-sm">
                {o.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-4">
                    <span className="text-muted">
                      {i.quantity} × {i.productName}
                    </span>
                    <span className="shrink-0">
                      {convertAndFormat(Number(i.unitPrice) * i.quantity, o.currency, currency)}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-3 flex justify-between border-t border-border pt-3 font-display text-lg font-bold">
                <span>{t('myord.total')}</span>
                <span className="text-brand-violet">
                  {convertAndFormat(Number(o.totalAmount), o.currency, currency)}
                </span>
              </p>

              <EstimatedDelivery order={o} />

              {(o.carrier || o.trackingNumber) && (
                <div className="mt-3 rounded-xl bg-surface-2 px-4 py-3 text-sm">
                  {o.carrier && (
                    <p>
                      <span className="text-faint">{t('myord.carrier')} </span>
                      <strong>{o.carrier}</strong>
                    </p>
                  )}
                  {o.trackingNumber && (
                    <p className="break-all">
                      <span className="text-faint">{t('myord.tracking')} </span>
                      <strong>{o.trackingNumber}</strong>
                    </p>
                  )}
                  {o.trackingUrl && (
                    <a
                      href={o.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-brand-violet hover:underline"
                    >
                      {t('myord.follow')} ↗
                    </a>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
