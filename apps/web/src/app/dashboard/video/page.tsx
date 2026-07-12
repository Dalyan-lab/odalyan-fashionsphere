'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AdTone, type VideoAsset, type VideoProviderInfo } from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Product } from '@/lib/types';
import { Topbar } from '@/components/dashboard/topbar';
import { Icon } from '@/components/dashboard/icons';

const LANGS = ['fr', 'en', 'ar', 'es'];

export default function VideoStudioPage() {
  const t = useT();
  const [providers, setProviders] = useState<VideoProviderInfo[]>([]);
  const [providerId, setProviderId] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [noShop, setNoShop] = useState(false);

  const [productId, setProductId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [script, setScript] = useState('');
  const [tone, setTone] = useState<AdTone>(AdTone.LUXE);
  const [language, setLanguage] = useState('fr');
  const [opts, setOpts] = useState<Record<string, string>>({});

  const [asset, setAsset] = useState<VideoAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    apiFetch<VideoProviderInfo[]>('/ai/video/providers')
      .then((list) => {
        setProviders(list);
        if (list[0]) setProviderId(list[0].id);
      })
      .catch(() => undefined);
    apiFetch<Product[]>('/products/mine')
      .then((p) => {
        setProducts(p);
        if (p[0]) setProductId(p[0].id);
      })
      .catch(() => setNoShop(true));
  }, []);

  const provider = providers.find((p) => p.id === providerId);

  // Réinitialise les options par défaut quand on change de fournisseur
  useEffect(() => {
    if (!provider) return;
    const defaults: Record<string, string> = {};
    provider.options.forEach((o) => {
      defaults[o.key] = o.default ?? o.values[0]?.value ?? '';
    });
    setOpts(defaults);
    setAsset(null);
  }, [providerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling tant que la vidéo est en cours
  useEffect(() => {
    if (poll.current) clearInterval(poll.current);
    if (asset?.status === 'PENDING') {
      poll.current = setInterval(async () => {
        try {
          const updated = await apiFetch<VideoAsset>(`/ai/video/${asset.id}`);
          setAsset(updated);
          if (updated.status !== 'PENDING' && poll.current) clearInterval(poll.current);
        } catch {
          /* ignore */
        }
      }, 5000);
    }
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, [asset?.status, asset?.id]);

  const selectedProduct = products.find((p) => p.id === productId);

  const generate = async () => {
    setError('');
    setLoading(true);
    setAsset(null);
    try {
      const res = await apiFetch<VideoAsset>('/ai/video', {
        method: 'POST',
        body: JSON.stringify({
          providerId,
          productId: productId || undefined,
          productName: selectedProduct?.name,
          imageUrl: selectedProduct?.images[0],
          prompt: prompt.trim() || undefined,
          script: script.trim() || undefined,
          tone,
          language,
          model: opts.model,
          ratio: opts.ratio,
          duration: opts.duration ? Number(opts.duration) : undefined,
        }),
      });
      setAsset(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const meta = asset?.meta ?? null;
  const needs = (k: string) => provider?.needs.includes(k as never);

  return (
    <>
      <Topbar />
      <div className="p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-violet-magenta text-white">🎥</span>
          <div>
            <h1 className="font-display text-3xl font-bold">{t('dash.nav.video')}</h1>
            <p className="text-muted">{t('vid.subtitle')}</p>
          </div>
          <span className="ml-3 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-bold text-brand-violet">
            Phase 4
          </span>
        </div>

        {noShop ? (
          <div className="card mt-6 p-10 text-center text-muted">
            {t('common.mustCreateShop')}
            <Link href="/dashboard" className="btn-primary mx-auto mt-4 block w-fit">{t('dh.createShop')}</Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
            {/* Contrôles */}
            <div className="space-y-5">
              {/* Choix du fournisseur */}
              <div className="card p-5">
                <h2 className="mb-3 font-bold">{t('vid.provider')}</h2>
                <div className="space-y-2">
                  {providers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setProviderId(p.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${providerId === p.id ? 'border-brand-violet bg-surface-2' : 'border-border'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{p.label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${p.enabled ? 'bg-emerald-500/15 text-emerald-500' : 'bg-surface text-faint'}`}>
                          {p.enabled ? t('vid.keyOk') : t('vid.simBadge')}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted">{p.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Brief */}
              <div className="card space-y-4 p-5">
                <h2 className="font-bold">{t('vid.brief')}</h2>
                <div>
                  <label className="label">{t('common.product')}</label>
                  {products.length === 0 ? (
                    <p className="text-sm text-muted">{t('common.noProducts')} <Link href="/dashboard/products" className="text-brand-violet hover:underline">{t('common.addOne')}</Link>.</p>
                  ) : (
                    <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {needs('prompt') && (
                  <div>
                    <label className="label">{t('vid.motion')}</label>
                    <textarea
                      className="input min-h-[70px]"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={t('vid.motionPh')}
                    />
                  </div>
                )}

                {needs('script') && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">{t('aim.tone')}</label>
                        <select className="input" value={tone} onChange={(e) => setTone(e.target.value as AdTone)}>
                          {Object.values(AdTone).map((tn) => (
                            <option key={tn} value={tn}>{tn}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">{t('vid.language')}</label>
                        <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
                          {LANGS.map((code) => (
                            <option key={code} value={code}>{t(`lang.${code}`)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="label">{t('vid.script')}</label>
                      <textarea className="input min-h-[70px]" value={script} onChange={(e) => setScript(e.target.value)} placeholder={t('vid.scriptPh')} />
                    </div>
                  </>
                )}

                {/* Options dynamiques du fournisseur */}
                {provider && provider.options.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {provider.options.map((o) => (
                      <div key={o.key}>
                        <label className="label">{o.label}</label>
                        <select
                          className="input"
                          value={opts[o.key] ?? ''}
                          onChange={(e) => setOpts((prev) => ({ ...prev, [o.key]: e.target.value }))}
                        >
                          {o.values.map((v) => (
                            <option key={v.value} value={v.value}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                {error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{error}</p>}

                <button onClick={generate} disabled={loading || !provider} className="btn-primary w-full">
                  {loading ? t('common.generating') : <>{Icon.sparkles({ width: 16, height: 16 })} {t('vid.generate')}</>}
                </button>
                {provider && !provider.enabled && (
                  <p className="text-[10px] text-faint">{t('vid.noKey')}</p>
                )}
              </div>
            </div>

            {/* Résultat */}
            <div>
              {!asset ? (
                <div className="card grid h-full min-h-[340px] place-items-center p-10 text-center text-muted">
                  <div>
                    <p className="text-5xl">🎥</p>
                    <p className="mt-3">{t('vid.emptyHint')}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="card overflow-hidden">
                    <div className="relative aspect-video bg-black">
                      {asset.status === 'READY' && asset.url ? (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <video src={asset.url} controls autoPlay loop className="h-full w-full" />
                      ) : asset.status === 'PENDING' ? (
                        <div className="grid h-full place-items-center text-center text-white/80">
                          <div>
                            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-brand-magenta" />
                            <p className="mt-3 text-sm">{t('common.generating')} ({asset.provider})</p>
                          </div>
                        </div>
                      ) : asset.status === 'FAILED' ? (
                        <div className="grid h-full place-items-center text-red-300">{t('vid.failed')}</div>
                      ) : (
                        <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_30%,rgba(124,58,237,0.4),transparent_60%)] p-6 text-center text-white">
                          <div>
                            <p className="text-4xl">🎬</p>
                            <p className="mt-2 font-semibold">{t('vid.simMode')}</p>
                            <p className="mx-auto mt-1 max-w-sm text-sm text-white/70">{t('vid.simModeDesc')}</p>
                            {meta?.imageUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={meta.imageUrl} alt="" className="mx-auto mt-4 h-40 rounded-lg object-cover" />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-3 text-xs text-faint">
                      {asset.provider === 'mock' ? t('common.simulated') : `✨ ${asset.provider}`} · {asset.status}
                    </div>
                  </div>

                  {meta?.script && (
                    <div className="card p-4">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-faint">{t('vid.spokenScript')}</span>
                        <button onClick={() => navigator.clipboard?.writeText(meta.script ?? '')} className="text-xs text-brand-violet hover:underline">
                          {t('aim.copy')}
                        </button>
                      </div>
                      <p className="text-sm">{meta.script}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
