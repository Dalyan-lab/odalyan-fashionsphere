'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CREDIT_PACKS, AI_CREDIT_COSTS, type CreditPack } from '@odalyan/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { Topbar } from '@/components/dashboard/topbar';
import { Icon } from '@/components/dashboard/icons';

interface Balance {
  credits: number;
  monthly: number;
  extra: number;
  plan: string;
  monthlyAllowance: number;
}

export default function CreditsPage() {
  const t = useT();
  const [bal, setBal] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const loadBalance = useCallback(() => {
    apiFetch<Balance>('/credits/balance')
      .then(setBal)
      .catch(() => setBal(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  async function buy(pack: CreditPack) {
    setError(null);
    setOk(null);
    setBuying(pack.id);
    try {
      const res = await apiFetch<{ link: string | null }>('/credits/purchase', {
        method: 'POST',
        body: JSON.stringify({ packId: pack.id }),
      });
      if (res.link) {
        // Paystack : redirection vers la page de paiement hébergée
        window.location.href = res.link;
        return;
      }
      // Mode simulé (sans Paystack) : crédité immédiatement
      setOk(t('credits.buyOkMock').replace('{n}', String(pack.credits)));
      loadBalance();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('credits.buyError'));
    } finally {
      setBuying(null);
    }
  }

  return (
    <>
      <Topbar />
      <div className="p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-violet-magenta text-white">
            {Icon.sparkles({})}
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold">{t('credits.pageTitle')}</h1>
            <p className="text-muted">{t('credits.pageSubtitle')}</p>
          </div>
        </div>

        {/* Solde actuel */}
        <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
          {loading ? (
            <p className="text-muted">{t('common.loading')}</p>
          ) : bal ? (
            <>
              <div>
                <p className="text-xs text-faint">{t('credits.balance')}</p>
                <p className="mt-1 font-display text-4xl font-bold text-brand-violet">{bal.credits}</p>
                <p className="mt-1 text-xs text-faint">
                  {t('credits.breakdown')
                    .replace('{monthly}', String(bal.monthly))
                    .replace('{allowance}', String(bal.monthlyAllowance))
                    .replace('{extra}', String(bal.extra))}
                </p>
              </div>
              <div className="text-sm text-muted">
                <p>💡 {t('credits.costImage').replace('{n}', String(AI_CREDIT_COSTS.image))}</p>
                <p>👗 {t('credits.costTryon').replace('{n}', String(AI_CREDIT_COSTS.tryon))}</p>
                <p>🎬 {t('credits.costVideo').replace('{n}', String(AI_CREDIT_COSTS.video))}</p>
              </div>
            </>
          ) : (
            <p className="text-muted">{t('common.mustCreateShop')}</p>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-brand-magenta/40 bg-brand-magenta/10 p-3 text-sm text-brand-magenta">
            {error}
          </div>
        )}
        {ok && (
          <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-600">
            ✅ {ok}
          </div>
        )}

        {/* Packs de recharge */}
        <h2 className="mt-8 font-display text-xl font-bold">{t('credits.choosePack')}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.id}
              className={`card relative p-5 ${pack.popular ? 'border-brand-violet ring-1 ring-brand-violet/40' : ''}`}
            >
              {pack.popular && (
                <span className="absolute right-3 top-3 rounded-full bg-brand-violet-magenta px-2 py-0.5 text-[10px] font-bold text-white">
                  {t('credits.popular')}
                </span>
              )}
              <h3 className="font-display text-lg font-bold">{pack.label}</h3>
              <p className="mt-2 font-display text-3xl font-bold text-brand-violet">
                {pack.credits}
                <span className="ml-1 text-sm font-normal text-faint">{t('credits.unit')}</span>
              </p>
              <p className="mt-1 text-lg font-semibold">{pack.priceEur} €</p>
              <button
                onClick={() => buy(pack)}
                disabled={buying !== null || !bal}
                className="btn-primary mt-4 w-full disabled:opacity-50"
              >
                {buying === pack.id ? t('credits.redirecting') : t('credits.buy')}
              </button>
            </div>
          ))}
        </div>

        <div className="card mt-6 flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm text-muted">{t('credits.orUpgrade')}</p>
          <Link href="/dashboard/subscriptions" className="btn-secondary">
            {t('dash.upgrade.cta')}
          </Link>
        </div>
      </div>
    </>
  );
}
