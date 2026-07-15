'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  SubscriptionPlan,
  PLAN_AI_CREDITS,
  planPrice,
  type BillingPeriod,
  type CouponPreview,
  type SubscriptionStatusDto,
} from '@odalyan/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { Topbar } from '@/components/dashboard/topbar';
import { Icon } from '@/components/dashboard/icons';

interface PlanCard {
  id: SubscriptionPlan;
  name: string;
  tag: string;
  features: string[];
  highlight?: boolean;
}

const PLANS: PlanCard[] = [
  {
    id: SubscriptionPlan.STARTER,
    name: 'Découverte',
    tag: 'Pour tester la plateforme.',
    features: ['Boutique en ligne + 50 produits', 'Liens d’affiliation ViralAmazone', 'Paiement Mobile Money & carte'],
  },
  {
    id: SubscriptionPlan.PRO,
    name: 'Créateur',
    tag: 'Le contenu qui fait vendre.',
    highlight: true,
    features: ['Produits illimités', 'Mannequins & avatars IA (vos photos)', 'Campagnes IA multi-réseaux', 'Scripts viraux + niveaux'],
  },
  {
    id: SubscriptionPlan.BUSINESS,
    name: 'Studio Pro',
    tag: 'L’atelier complet.',
    features: ['Tout Créateur, plus', 'Vidéos IA (défilé, animation)', 'Essayage virtuel & défilé 360°', 'Priorité de génération'],
  },
  {
    id: SubscriptionPlan.ENTERPRISE,
    name: 'Marque',
    tag: 'Votre marque, à grande échelle.',
    features: ['Tout Studio Pro, plus', 'Domaine perso & marque blanche', 'API complète', 'Accompagnement dédié'],
  },
];

const RATE = 655.957; // EUR → XOF (indicatif)

export default function SubscriptionsPage() {
  const t = useT();
  const [status, setStatus] = useState<SubscriptionStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<CouponPreview | null>(null);
  const [couponMsg, setCouponMsg] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const load = () => {
    apiFetch<SubscriptionStatusDto>('/subscriptions/me')
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  async function applyCoupon() {
    if (!couponInput.trim()) return;
    setCouponMsg('');
    try {
      const preview = await apiFetch<CouponPreview>('/subscriptions/coupon/preview', {
        method: 'POST',
        body: JSON.stringify({ code: couponInput.trim(), plan: SubscriptionPlan.PRO, period }),
      });
      if (preview.valid) setCoupon(preview);
      else {
        setCoupon(null);
        setCouponMsg(preview.reason ?? t('coupon.invalid'));
      }
    } catch (e) {
      setCoupon(null);
      setCouponMsg(e instanceof ApiError ? e.message : t('coupon.invalid'));
    }
  }

  async function choose(plan: SubscriptionPlan) {
    setError('');
    setOk('');
    setBusy(plan);
    try {
      const res = await apiFetch<{ link: string | null; activated: boolean }>('/subscriptions/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan, period, couponCode: coupon?.code }),
      });
      if (res.link) {
        window.location.href = res.link;
        return;
      }
      setOk(plan === SubscriptionPlan.STARTER ? t('sub.downgraded') : t('sub.activated'));
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.error'));
    } finally {
      setBusy(null);
    }
  }

  const currentPlan = status?.plan ?? SubscriptionPlan.STARTER;
  const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('fr-FR') : null);

  // Prix affiché (remisé si coupon en %), en FCFA + €
  function priceLabel(plan: SubscriptionPlan): { fcfa: string; eur: string; struck?: string } | null {
    if (plan === SubscriptionPlan.STARTER) return null;
    const base = planPrice(plan, period);
    let final = base;
    if (coupon?.label?.includes('%') && coupon.originalEur && coupon.finalEur != null) {
      final = Math.round(base * (coupon.finalEur / coupon.originalEur));
    }
    const fcfa = Math.round(final * RATE).toLocaleString('fr-FR');
    return {
      fcfa: `${fcfa} FCFA`,
      eur: `≈ ${final} €${period === 'annual' ? ' /mois·an' : ' /mois'}`,
      struck: final !== base ? `${Math.round(base * RATE).toLocaleString('fr-FR')} FCFA` : undefined,
    };
  }

  return (
    <>
      <Topbar />
      <div className="p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-violet-magenta text-white">
            {Icon.subscriptions({})}
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold">{t('dash.nav.subscriptions')}</h1>
            <p className="text-muted">{t('sub.subtitle')}</p>
          </div>
        </div>

        {loading ? (
          <p className="mt-6 text-muted">{t('common.loading')}</p>
        ) : !status ? (
          <div className="card mt-6 p-10 text-center text-muted">
            {t('common.mustCreateShop')}
            <Link href="/dashboard" className="btn-primary mx-auto mt-4 block w-fit">{t('dh.createShop')}</Link>
          </div>
        ) : (
          <>
            {/* Plan actuel */}
            <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
              <div>
                <p className="text-xs text-faint">{t('sub.current')}</p>
                <p className="mt-1 font-display text-3xl font-bold text-brand-violet">{currentPlan}</p>
                {status.expiresAt && (
                  <p className={`mt-1 text-xs ${status.expired ? 'text-brand-magenta' : 'text-faint'}`}>
                    {status.expired ? t('sub.expiredOn') : t('sub.renewsOn')} {fmtDate(status.expiresAt)}
                  </p>
                )}
              </div>
              {/* Toggle période */}
              <div className="flex gap-1 rounded-full border border-border bg-surface-2 p-1">
                {(['monthly', 'annual'] as BillingPeriod[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${period === p ? 'bg-brand-violet-magenta text-white' : 'text-muted'}`}
                  >
                    {p === 'monthly' ? t('sub.monthly') : t('sub.annual')}
                    {p === 'annual' && <span className="ml-1 text-[10px] opacity-80">{t('sub.save2')}</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Coupon */}
            <div className="mt-4 rounded-xl border border-border bg-surface-2 p-4">
              <label className="label">{t('coupon.haveCode')}</label>
              <div className="flex flex-wrap gap-2">
                <input
                  className="input flex-1"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value.toUpperCase());
                    setCoupon(null);
                    setCouponMsg('');
                  }}
                  placeholder="FONDATEUR"
                />
                <button onClick={applyCoupon} disabled={!couponInput.trim()} className="btn-secondary">
                  {t('coupon.apply')}
                </button>
              </div>
              {coupon && (
                <p className="mt-2 text-sm font-semibold text-emerald-600">
                  ✅ {t('coupon.applied').replace('{code}', coupon.code)} {coupon.label}
                </p>
              )}
              {couponMsg && <p className="mt-2 text-sm text-brand-magenta">{couponMsg}</p>}
            </div>

            {error && <div className="mt-4 rounded-xl border border-brand-magenta/40 bg-brand-magenta/10 p-3 text-sm text-brand-magenta">{error}</div>}
            {ok && <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-600">✅ {ok}</div>}

            {/* Offres */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {PLANS.map((p) => {
                const isCurrent = p.id === currentPlan;
                const price = priceLabel(p.id);
                return (
                  <div
                    key={p.id}
                    className={`card relative flex flex-col p-5 ${p.highlight ? 'border-brand-violet ring-1 ring-brand-violet/40' : ''} ${isCurrent ? 'ring-1 ring-emerald-500/40' : ''}`}
                  >
                    {p.highlight && !isCurrent && (
                      <span className="absolute right-3 top-3 rounded-full bg-brand-violet-magenta px-2 py-0.5 text-[10px] font-bold text-white">
                        {t('sub.popular')}
                      </span>
                    )}
                    {isCurrent && (
                      <span className="absolute right-3 top-3 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                        {t('sub.yourPlan')}
                      </span>
                    )}
                    <h2 className="font-display text-xl font-bold">{p.name}</h2>
                    <p className="mt-1 text-xs text-muted">{p.tag}</p>

                    <div className="mt-3">
                      {price ? (
                        <>
                          {price.struck && <p className="text-xs text-faint line-through">{price.struck}</p>}
                          <p className="font-display text-2xl font-bold text-brand-violet">{price.fcfa}</p>
                          <p className="text-[11px] text-faint">{price.eur}</p>
                        </>
                      ) : (
                        <p className="font-display text-2xl font-bold text-brand-violet">{t('sub.free')}</p>
                      )}
                    </div>

                    <p className="mt-3 rounded-lg bg-surface-2 px-2 py-1 text-center text-[11px] font-mono text-brand-violet">
                      {PLAN_AI_CREDITS[p.id]} {t('sub.creditsMonth')}
                    </p>

                    <ul className="mt-3 flex-1 space-y-1.5 text-sm text-muted">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <span className="text-emerald-500">✓</span> {f}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => choose(p.id)}
                      disabled={busy !== null || isCurrent}
                      className={`mt-4 w-full rounded-lg py-2 text-sm font-semibold transition disabled:opacity-50 ${p.highlight ? 'bg-brand-violet-magenta text-white' : 'border border-border text-content hover:bg-surface-hover'}`}
                    >
                      {isCurrent ? t('sub.currentBtn') : busy === p.id ? t('credits.redirecting') : p.id === SubscriptionPlan.STARTER ? t('sub.downgrade') : t('sub.choose')}
                    </button>
                  </div>
                );
              })}
            </div>

            <p className="mt-6 text-center text-xs text-faint">{t('sub.paymentNote')}</p>
          </>
        )}
      </div>
    </>
  );
}
