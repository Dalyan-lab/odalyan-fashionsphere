'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';

interface Balance {
  credits: number;
  plan: string;
  monthlyAllowance: number;
}

/** Solde de crédits IA du vendeur (barre + lien upgrade). Masqué si pas de boutique. */
export function AiCreditsCard() {
  const t = useT();
  const [bal, setBal] = useState<Balance | null>(null);

  useEffect(() => {
    apiFetch<Balance>('/shops/me/credits')
      .then(setBal)
      .catch(() => setBal(null));
  }, []);

  if (!bal) return null;

  const pct = bal.monthlyAllowance ? Math.min(100, (bal.credits / bal.monthlyAllowance) * 100) : 0;
  const low = bal.credits <= Math.max(1, bal.monthlyAllowance * 0.1);

  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface-2 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{t('credits.title')}</p>
        <span className={`text-sm font-bold ${low ? 'text-brand-magenta' : 'text-brand-violet'}`}>
          {bal.credits}
          <span className="text-xs font-normal text-faint">/{bal.monthlyAllowance}</span>
        </span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-surface">
        <div
          className={`h-full rounded-full ${low ? 'bg-brand-magenta' : 'bg-brand-violet-magenta'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-[10px] text-faint">{t('credits.hint')}</p>
      <Link
        href="/dashboard/credits"
        className={`mt-2 block rounded-lg py-1.5 text-center text-xs font-semibold ${
          low ? 'bg-brand-violet-magenta text-white' : 'border border-border text-muted hover:bg-surface-hover'
        }`}
      >
        {t('credits.recharge')}
      </Link>
    </div>
  );
}
