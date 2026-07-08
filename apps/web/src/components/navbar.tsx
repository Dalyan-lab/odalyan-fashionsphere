'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useAuth, useCart } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { ThemeToggle } from './theme-provider';
import { LocaleSwitcher } from './locale-switcher';

export function Navbar() {
  const { user, clear } = useAuth();
  const items = useCart((s) => s.items);
  const t = useT();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cartCount = mounted ? items.reduce((n, i) => n + i.quantity, 0) : 0;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/70 backdrop-blur-lg">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="Odalyan" width={40} height={40} className="h-10 w-10 object-contain" />
          <span className="font-display text-xl font-bold tracking-wide">
            Odalyan <span className="brand-gradient-text">FashionSphere</span>
          </span>
        </Link>

        <div className="hidden items-center gap-8 text-sm text-muted md:flex">
          <Link href="/marketplace" className="transition hover:text-content">
            {t('nav.marketplace')}
          </Link>
          <Link href="/#features" className="transition hover:text-content">
            {t('nav.features')}
          </Link>
          <Link href="/#pricing" className="transition hover:text-content">
            {t('nav.pricing')}
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <ThemeToggle />
          <Link href="/cart" className="relative grid h-10 w-10 place-items-center rounded-xl border border-border text-content transition hover:bg-surface-hover">
            🛒
            {cartCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-brand-magenta text-xs font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>
          {mounted && user ? (
            <>
              {user.role === 'ADMIN' && (
                <Link href="/admin" className="btn-ghost px-4 py-2 text-sm">
                  🛡️ Admin
                </Link>
              )}
              <Link href="/dashboard" className="btn-ghost px-4 py-2 text-sm">
                {t('nav.dashboard')}
              </Link>
              <button onClick={clear} className="text-sm text-muted transition hover:text-content">
                {t('nav.logout')}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-muted transition hover:text-content">
                {t('nav.login')}
              </Link>
              <Link href="/register" className="btn-primary px-4 py-2 text-sm">
                {t('nav.createShop')}
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
