'use client';

import Link from 'next/link';
import { Icon } from './icons';
import { ThemeToggle } from '../theme-provider';
import { LocaleSwitcher } from '../locale-switcher';
import { NotificationBell } from './notification-bell';
import { useSidebar, useShop } from '@/lib/store';
import { useT } from '@/lib/i18n';

export function Topbar({ userInitial = 'O' }: { userInitial?: string }) {
  const toggle = useSidebar((s) => s.toggle);
  const shop = useShop((s) => s.shop);
  const t = useT();
  const initial = (shop?.name ?? userInitial ?? 'O').charAt(0).toUpperCase();

  return (
    <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-bg/80 px-4 py-3 backdrop-blur-lg sm:px-6">
      {/* Burger (mobile) */}
      <button
        onClick={toggle}
        aria-label={t('dash.menu')}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border text-content transition hover:bg-surface-hover lg:hidden"
      >
        {Icon.menu({})}
      </button>

      <div className="relative hidden flex-1 sm:block sm:max-w-md">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
          {Icon.search({})}
        </span>
        <input placeholder={t('dash.search')} className="input py-2.5 pl-10" />
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        <LocaleSwitcher />
        <ThemeToggle />
        <NotificationBell />
        <Link href="/dashboard/shop" title={shop?.name ?? ''} className="shrink-0">
          {shop?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shop.logoUrl} alt="" className="h-10 w-10 rounded-full border border-border object-cover" />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-gradient text-sm font-bold text-white">
              {initial}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}
