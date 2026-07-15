'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SubscriptionStatusDto } from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';

const REMINDER_DAYS = 3;

/**
 * Bannière de rappel d'expiration : visible quand le plan payant expire dans
 * ≤ 3 jours ou vient d'expirer. Complète l'email automatique — pousse au renouvellement.
 */
export function SubscriptionBanner() {
  const t = useT();
  const [sub, setSub] = useState<SubscriptionStatusDto | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    apiFetch<SubscriptionStatusDto>('/subscriptions/me')
      .then(setSub)
      .catch(() => setSub(null));
  }, []);

  if (!sub || dismissed || !sub.expiresAt || sub.plan === 'STARTER') return null;

  const daysLeft = Math.ceil((new Date(sub.expiresAt).getTime() - Date.now()) / 86_400_000);
  if (daysLeft > REMINDER_DAYS) return null;

  const expired = sub.expired || daysLeft <= 0;
  const dateStr = new Date(sub.expiresAt).toLocaleDateString('fr-FR');

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm ${
        expired ? 'bg-brand-magenta/15 text-brand-magenta' : 'bg-amber-500/15 text-amber-600'
      }`}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden>⏳</span>
        {expired
          ? t('subBanner.expired').replace('{plan}', sub.plan).replace('{date}', dateStr)
          : t('subBanner.expiring')
              .replace('{plan}', sub.plan)
              .replace('{n}', String(daysLeft))
              .replace('{date}', dateStr)}
      </span>
      <span className="flex items-center gap-3">
        <Link
          href="/dashboard/subscriptions"
          className="rounded-lg bg-brand-violet-magenta px-3 py-1 text-xs font-semibold text-white"
        >
          {t('subBanner.renew')}
        </Link>
        <button onClick={() => setDismissed(true)} className="text-xs opacity-70 hover:opacity-100" aria-label="Fermer">
          ✕
        </button>
      </span>
    </div>
  );
}
