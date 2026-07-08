'use client';

import { useEffect, useState } from 'react';
import { CURRENCIES, useLocale, type Lang } from '@/lib/i18n';

export function LocaleSwitcher() {
  const { lang, currency, setLang, setCurrency } = useLocale();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label="Langue"
        className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs text-content outline-none"
      >
        <option value="fr">🇫🇷 FR</option>
        <option value="en">🇬🇧 EN</option>
      </select>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        aria-label="Devise"
        className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs text-content outline-none"
      >
        {Object.values(CURRENCIES).map((c) => (
          <option key={c.code} value={c.code}>
            {c.code}
          </option>
        ))}
      </select>
    </div>
  );
}
