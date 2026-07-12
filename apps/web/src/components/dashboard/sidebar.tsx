'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Icon, type IconName } from './icons';
import { useSidebar, useAuth } from '@/lib/store';
import { useT } from '@/lib/i18n';

interface NavItem {
  key: string;
  href: string;
  icon: IconName;
  phase?: string;
}

const NAV: NavItem[] = [
  { key: 'dash.nav.dashboard', href: '/dashboard', icon: 'dashboard' },
  { key: 'dash.nav.products', href: '/dashboard/products', icon: 'products' },
  { key: 'dash.nav.orders', href: '/dashboard/orders', icon: 'orders' },
  { key: 'dash.nav.clients', href: '/dashboard/clients', icon: 'clients' },
  { key: 'dash.nav.shop', href: '/dashboard/shop', icon: 'shop' },
  { key: 'dash.nav.studio', href: '/dashboard/studio', icon: 'sparkles' },
  { key: 'dash.nav.campaigns', href: '/dashboard/campaigns', icon: 'marketing' },
  { key: 'dash.nav.avatars', href: '/dashboard/avatars', icon: 'avatars' },
  { key: 'dash.nav.tryon', href: '/dashboard/tryon', icon: 'shirt' },
  { key: 'dash.nav.defile', href: '/dashboard/defile', icon: 'play' },
  { key: 'dash.nav.video', href: '/dashboard/video', icon: 'video' },
  { key: 'dash.nav.publications', href: '/dashboard/publications', icon: 'publications', phase: 'P5' },
  { key: 'dash.nav.stats', href: '/dashboard/stats', icon: 'stats' },
  { key: 'dash.nav.subscriptions', href: '/dashboard/subscriptions', icon: 'subscriptions' },
  { key: 'dash.nav.settings', href: '/dashboard/settings', icon: 'settings' },
];

export function Sidebar({ shopName, shopLogo }: { shopName?: string; shopLogo?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { open, close } = useSidebar();
  const clearAuth = useAuth((s) => s.clear);
  const user = useAuth((s) => s.user);
  const t = useT();

  const logout = () => {
    clearAuth();
    close();
    router.push('/');
  };

  return (
    <>
      {/* Backdrop mobile */}
      {open && (
        <div
          onClick={close}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-border bg-[var(--sidebar)] px-4 py-5 transition-transform duration-300 lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Link href="/" onClick={close} className="mb-6 flex items-center gap-2.5 px-2">
          <Image src="/logo.png" alt="Odalyan" width={36} height={36} className="h-9 w-9 object-contain" />
          <span className="font-display text-lg font-bold leading-none">
            Fashion<span className="brand-gradient-text">Sphere</span>{' '}
            <span className="text-brand-blue">AI</span>
          </span>
        </Link>

        <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin">
          {user?.role === 'ADMIN' && (
            <Link
              href="/admin"
              onClick={close}
              className={`group mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                pathname === '/admin'
                  ? 'bg-brand-violet-magenta text-white shadow-lg'
                  : 'border border-brand-violet/40 text-brand-violet hover:bg-surface-hover'
              }`}
            >
              <span aria-hidden>🛡️</span>
              <span className="flex-1">Administration</span>
            </Link>
          )}
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-brand-violet-magenta text-white shadow-lg'
                    : 'text-muted hover:bg-surface-hover hover:text-content'
                }`}
              >
              <span className={active ? 'text-white' : 'text-faint group-hover:text-content'}>
                {Icon[item.icon]({})}
              </span>
              <span className="flex-1">{t(item.key)}</span>
              {item.phase && (
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                    active ? 'bg-white/20 text-white' : 'bg-surface-2 text-faint'
                  }`}
                >
                  {item.phase}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Carte upgrade Pro */}
      <div className="mt-4 rounded-2xl bg-brand-violet-magenta p-4 text-white">
        <p className="text-sm font-semibold">{t('dash.upgrade.title')}</p>
        <p className="mt-1 text-xs text-white/80">{t('dash.upgrade.desc')}</p>
        <Link
          href="/dashboard/subscriptions"
          className="mt-3 block rounded-lg bg-white/15 py-2 text-center text-xs font-semibold backdrop-blur transition hover:bg-white/25"
        >
          {t('dash.upgrade.cta')}
        </Link>
      </div>

      {/* Profil */}
      <div className="mt-4 rounded-xl px-2 py-2">
        <div className="flex items-center gap-3">
          {shopLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shopLogo} alt="" className="h-9 w-9 shrink-0 rounded-full border border-border object-cover" />
          ) : (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-gradient text-sm font-bold text-white">
              {(shopName ?? 'O').charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{shopName ?? t('dash.profile.myStore')}</p>
            <p className="text-xs text-faint">{t('dash.profile.store')}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm text-muted transition hover:bg-surface-hover hover:text-content"
        >
          <span aria-hidden>⏻</span> {t('nav.logout')}
        </button>
      </div>
      </aside>
    </>
  );
}
