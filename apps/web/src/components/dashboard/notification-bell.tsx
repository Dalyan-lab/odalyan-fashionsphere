'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { Icon } from './icons';

interface OrderNotif {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: string;
  currency: string;
  createdAt: string;
  customer?: { firstName: string; lastName: string };
}

const PAID = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

export function NotificationBell() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<OrderNotif[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<OrderNotif[]>('/orders/shop')
      .then((list) => setOrders(list.slice(0, 6)))
      .catch(() => setOrders([]));
  }, []);

  // Ferme au clic extérieur
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unread = orders?.filter((o) => PAID.includes(o.status)).length ?? 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-border text-content transition hover:bg-surface-hover"
      >
        {Icon.bell({})}
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-magenta px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-bold">{t('notif.title')}</p>
          </div>
          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {orders === null ? (
              <p className="px-4 py-6 text-center text-sm text-muted">{t('common.loading')}</p>
            ) : orders.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">{t('notif.empty')}</p>
            ) : (
              orders.map((o) => (
                <Link
                  key={o.id}
                  href="/dashboard/orders"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 border-b border-border px-4 py-3 transition hover:bg-surface-hover"
                >
                  <span
                    className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${PAID.includes(o.status) ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {PAID.includes(o.status) ? t('notif.newOrder') : t('notif.order')} {o.orderNumber}
                    </p>
                    <p className="text-xs text-faint">
                      {o.customer ? `${o.customer.firstName} ${o.customer.lastName} · ` : ''}
                      {Number(o.totalAmount).toFixed(2)} {o.currency} · {t(`os.${o.status}`)}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
          <Link
            href="/dashboard/orders"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-center text-sm font-medium text-brand-violet hover:underline"
          >
            {t('notif.viewAll')}
          </Link>
        </div>
      )}
    </div>
  );
}
