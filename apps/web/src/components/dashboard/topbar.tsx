'use client';

import { Icon } from './icons';
import { ThemeToggle } from '../theme-provider';
import { LocaleSwitcher } from '../locale-switcher';
import { useSidebar } from '@/lib/store';
import { useT } from '@/lib/i18n';

export function Topbar({ userInitial = 'O' }: { userInitial?: string }) {
  const toggle = useSidebar((s) => s.toggle);
  const t = useT();

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
        <button className="relative grid h-10 w-10 place-items-center rounded-xl border border-border text-content transition hover:bg-surface-hover">
          {Icon.bell({})}
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-brand-magenta" />
        </button>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-gradient text-sm font-bold text-white">
          {userInitial}
        </span>
      </div>
    </div>
  );
}
