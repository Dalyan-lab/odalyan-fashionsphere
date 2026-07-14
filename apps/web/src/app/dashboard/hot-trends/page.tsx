'use client';

import { useEffect, useState } from 'react';
import {
  AMAZON_MARKETPLACES,
  ScriptPlatform,
  TrendTier,
  type AmazonTrendProductDto,
  type ViralScriptDto,
} from '@odalyan/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { Topbar } from '@/components/dashboard/topbar';
import { Icon } from '@/components/dashboard/icons';

interface TrendsPage {
  items: AmazonTrendProductDto[];
  total: number;
  page: number;
  limit: number;
}

interface Status {
  keepa: boolean;
  paapiMarketplaces: string[];
  tracker: boolean;
}

const TIER_META: Record<TrendTier, { emoji: string; color: string; labelKey: string }> = {
  [TrendTier.SUPER_NOVA]: { emoji: '🔴', color: 'text-red-500 bg-red-500/10 border-red-500/30', labelKey: 'hot.tier.superNova' },
  [TrendTier.HOT_WOOD]: { emoji: '🔥', color: 'text-orange-500 bg-orange-500/10 border-orange-500/30', labelKey: 'hot.tier.hotWood' },
  [TrendTier.SLOW_BURN]: { emoji: '📈', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30', labelKey: 'hot.tier.slowBurn' },
};

export default function HotTrendsPage() {
  const t = useT();
  const [status, setStatus] = useState<Status | null>(null);
  const [data, setData] = useState<TrendsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [marketplace, setMarketplace] = useState('');
  const [tier, setTier] = useState<TrendTier | ''>('');
  const [panelProduct, setPanelProduct] = useState<AmazonTrendProductDto | null>(null);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (marketplace) params.set('marketplace', marketplace);
    if (tier) params.set('tier', tier);
    apiFetch<TrendsPage>(`/viral-amazone/trends?${params.toString()}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    apiFetch<Status>('/viral-amazone/status').then(setStatus).catch(() => setStatus(null));
  }, []);

  useEffect(load, [marketplace, tier]);

  return (
    <>
      <Topbar />
      <div className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-violet-magenta text-white">
            {Icon.flame({ width: 20, height: 20 })}
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold">{t('hot.title')}</h1>
            <p className="text-muted">{t('hot.subtitle')}</p>
          </div>
          {status && !status.tracker && (
            <span className="ml-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-500">
              {t('hot.demoMode')}
            </span>
          )}
        </div>

        {/* Filtres */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <select className="input w-auto" value={marketplace} onChange={(e) => setMarketplace(e.target.value)}>
            <option value="">{t('hot.allMarketplaces')}</option>
            {AMAZON_MARKETPLACES.map((m) => (
              <option key={m.domain} value={m.domain}>{m.label}</option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTier('')}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${tier === '' ? 'border-brand-violet bg-surface-2' : 'border-border text-muted'}`}
            >
              {t('hot.allTiers')}
            </button>
            {(Object.keys(TIER_META) as TrendTier[]).map((tk) => (
              <button
                key={tk}
                onClick={() => setTier(tk)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${tier === tk ? TIER_META[tk].color : 'border-border text-muted'}`}
              >
                {TIER_META[tk].emoji} {t(TIER_META[tk].labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Grille de produits */}
        {loading ? (
          <p className="mt-6 text-muted">{t('common.loading')}</p>
        ) : !data || data.items.length === 0 ? (
          <div className="card mt-6 p-10 text-center text-muted">
            <p className="text-5xl">🔥</p>
            <p className="mt-3">{t('hot.emptyHint')}</p>
            {status && !status.tracker && <p className="mt-1 text-xs text-faint">{t('hot.emptyDemoHint')}</p>}
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((p) => (
              <div key={p.id} className="card overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover" />
                  ) : (
                    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-surface-2 text-2xl">📦</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold">{p.title}</p>
                    <p className="mt-1 text-xs text-faint">
                      {p.currentPrice != null ? `${p.currentPrice} ${p.currency ?? ''}` : t('hot.priceUnknown')}
                      {p.currentRank != null && ` · #${p.currentRank}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  {p.trendTier ? (
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${TIER_META[p.trendTier].color}`}>
                      {TIER_META[p.trendTier].emoji} {p.velocity24h != null ? `+${Math.round(p.velocity24h)}%` : t(TIER_META[p.trendTier].labelKey)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-faint">{t('hot.noTier')}</span>
                  )}
                  <button onClick={() => setPanelProduct(p)} className="btn-primary px-3 py-1.5 text-xs">
                    ✨ {t('hot.createPost')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {panelProduct && <CreatePostPanel product={panelProduct} onClose={() => setPanelProduct(null)} />}
    </>
  );
}

function CreatePostPanel({ product, onClose }: { product: AmazonTrendProductDto; onClose: () => void }) {
  const t = useT();
  const [platform, setPlatform] = useState<ScriptPlatform>(ScriptPlatform.TIKTOK);
  const [script, setScript] = useState<ViralScriptDto | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<ViralScriptDto>('/viral-amazone/scripts/generate', {
        method: 'POST',
        body: JSON.stringify({ productId: product.id, platform }),
      });
      setScript(res);
      setDraft(`${res.hook}\n\n${res.problem}\n\n${res.solution}\n\n${res.cta}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text);

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" aria-hidden />
      <aside className="fixed inset-y-0 right-0 z-50 flex h-screen w-full max-w-lg flex-col overflow-y-auto border-l border-border bg-[var(--sidebar)] p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {product.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt="" className="h-12 w-12 rounded-lg border border-border object-cover" />
            )}
            <div>
              <h2 className="line-clamp-2 font-display text-lg font-bold">{product.title}</h2>
              <p className="text-xs text-faint">{t('hot.createPost')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-content">✕</button>
        </div>

        {/* Plateforme */}
        <div className="mt-5">
          <label className="label">{t('hot.platform')}</label>
          <div className="flex gap-2">
            {Object.values(ScriptPlatform).map((pf) => (
              <button
                key={pf}
                onClick={() => setPlatform(pf)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${platform === pf ? 'border-brand-violet bg-surface-2' : 'border-border text-muted'}`}
              >
                {pf}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{error}</p>}

        <button onClick={generate} disabled={loading} className="btn-primary mt-4 w-full">
          {loading ? t('hot.generating') : `✨ ${t('hot.generateScript')}`}
        </button>

        {script && (
          <div className="mt-6 space-y-4">
            <ScriptBlock label={t('hot.hook')} text={script.hook} onCopy={copy} />
            <ScriptBlock label={t('hot.problem')} text={script.problem} onCopy={copy} />
            <ScriptBlock label={t('hot.solution')} text={script.solution} onCopy={copy} />
            <ScriptBlock label={t('hot.cta')} text={script.cta} onCopy={copy} />

            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-faint">{t('hot.affiliateLink')}</span>
                <button onClick={() => copy(script.affiliateUrl)} className="text-xs text-brand-violet hover:underline">{t('aim.copy')}</button>
              </div>
              <p className="break-all rounded-lg bg-surface-2 p-2 text-xs text-muted">{script.affiliateUrl}</p>
            </div>

            {/* Studio : édition rapide avant copie */}
            <div>
              <label className="label">{t('hot.studio')}</label>
              <textarea
                className="input min-h-[140px]"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button onClick={() => copy(draft)} className="btn-primary mt-2 w-full">
                📋 {t('hot.copyFullScript')}
              </button>
            </div>

            {script.provider === 'mock' && (
              <p className="text-center text-[10px] text-faint">{t('hot.mockProviderHint')}</p>
            )}
          </div>
        )}
      </aside>
    </>
  );
}

function ScriptBlock({ label, text, onCopy }: { label: string; text: string; onCopy: (v: string) => void }) {
  const t = useT();
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-faint">{label}</span>
        <button onClick={() => onCopy(text)} className="text-xs text-brand-violet hover:underline">{t('aim.copy')}</button>
      </div>
      <p className="text-sm">{text}</p>
    </div>
  );
}
