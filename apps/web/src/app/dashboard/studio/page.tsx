'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { AdCopyResult } from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Product } from '@/lib/types';
import { Topbar } from '@/components/dashboard/topbar';
import { WorkflowSteps } from '@/components/dashboard/workflow-steps';
import { Icon } from '@/components/dashboard/icons';
import { MannequinForm, AdCopyForm } from '@/components/dashboard/ai-studio-modal';
import { AttachToProduct } from '@/components/dashboard/attach-to-product';

interface GeneratedAsset {
  id: string;
  type: string;
  provider: string;
  prompt?: string | null;
  url?: string | null;
  meta?: unknown;
  createdAt: string;
}

export default function StudioPage() {
  const t = useT();
  const [tab, setTab] = useState<'mannequin' | 'adcopy'>('mannequin');
  const [products, setProducts] = useState<Product[]>([]);
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [noShop, setNoShop] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAssets = useCallback(async () => {
    try {
      setAssets(await apiFetch<GeneratedAsset[]>('/ai/assets'));
      setNoShop(false);
    } catch {
      setNoShop(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    apiFetch<Product[]>('/products/mine')
      .then(setProducts)
      .catch(() => undefined);
    loadAssets();
  }, [loadAssets]);

  const deleteAsset = useCallback(
    async (id: string) => {
      if (!window.confirm(t('stu.deleteConfirm'))) return;
      setAssets((prev) => prev.filter((a) => a.id !== id)); // optimiste
      try {
        await apiFetch(`/ai/assets/${id}`, { method: 'DELETE' });
      } catch {
        loadAssets(); // rollback en cas d'échec
      }
    },
    [t, loadAssets],
  );

  const purgeSimulated = useCallback(async () => {
    if (!window.confirm(t('stu.purgeConfirm'))) return;
    try {
      await apiFetch('/ai/assets/simulated', { method: 'DELETE' });
    } finally {
      loadAssets();
    }
  }, [t, loadAssets]);

  const images = assets.filter((a) => a.url);
  const copies = assets.filter((a) => a.type === 'AD_COPY');
  const simulatedCount = assets.filter((a) => a.provider === 'mock').length;

  return (
    <>
      <Topbar />
      <div className="p-6">
        <WorkflowSteps />
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-violet-magenta text-white">
            {Icon.sparkles({})}
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold">{t('dash.nav.studio')}</h1>
            <p className="text-muted">{t('stu.subtitle')}</p>
          </div>
        </div>

        {noShop ? (
          <div className="card mt-6 p-10 text-center text-muted">
            {t('common.mustCreateShop')}
            <Link href="/dashboard" className="btn-primary mx-auto mt-4 block w-fit">{t('dh.createShop')}</Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[400px_1fr]">
            {/* Générateur */}
            <div className="card h-fit p-5">
              <div className="mb-4 flex gap-2 rounded-xl bg-surface-2 p-1">
                <button
                  onClick={() => setTab('mannequin')}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${tab === 'mannequin' ? 'bg-brand-violet-magenta text-white' : 'text-muted'}`}
                >
                  🎭 {t('dh.tool.mannequin')}
                </button>
                <button
                  onClick={() => setTab('adcopy')}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${tab === 'adcopy' ? 'bg-brand-violet-magenta text-white' : 'text-muted'}`}
                >
                  📣 {t('dh.tool.adcopy')}
                </button>
              </div>
              {tab === 'mannequin' ? (
                <MannequinForm products={products} onGenerated={loadAssets} />
              ) : (
                <AdCopyForm products={products} onGenerated={loadAssets} />
              )}
            </div>

            {/* Galerie */}
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold">{t('stu.gallery')} ({assets.length})</h2>
                {simulatedCount > 0 && (
                  <button
                    onClick={purgeSimulated}
                    className="rounded-lg border border-red-400/40 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/10"
                    title={t('stu.purgeHint')}
                  >
                    🧹 {t('stu.purgeSimulated')} ({simulatedCount})
                  </button>
                )}
              </div>
              {loading ? (
                <p className="text-muted">{t('common.loading')}</p>
              ) : assets.length === 0 ? (
                <div className="card p-10 text-center text-muted">
                  {t('stu.empty')}
                </div>
              ) : (
                <div className="space-y-6">
                  {images.length > 0 && (
                    <div>
                      <p className="label">{t('stu.images')}</p>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {images.map((a) => (
                          <div key={a.id} className="card group relative overflow-hidden">
                            <button
                              onClick={() => deleteAsset(a.id)}
                              className="absolute right-1.5 top-1.5 z-10 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white opacity-0 transition hover:bg-red-600 group-hover:opacity-100"
                              title={t('stu.delete')}
                              aria-label={t('stu.delete')}
                            >
                              ✕
                            </button>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={a.url!} alt="" className="aspect-[3/4] w-full object-cover" />
                            <div className="space-y-1 p-2">
                              {(() => {
                                const mode = (a.meta as { tryOnMode?: string } | null)?.tryOnMode;
                                if (mode === '2img')
                                  return <p className="text-[10px] font-medium text-emerald-400">👗 {t('stu.mode2img')}</p>;
                                if (mode === 'fallback-kontext')
                                  return <p className="text-[10px] font-medium text-amber-400">🎨 {t('stu.modeFallback')}</p>;
                                return null;
                              })()}
                              <p className="text-[10px] text-faint">
                                {a.provider === 'mock' ? t('common.simulated') : `✨ ${a.provider}`} ·{' '}
                                {new Date(a.createdAt).toLocaleDateString('fr-FR')}
                              </p>
                              <AttachToProduct url={a.url!} kind="image" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {copies.length > 0 && (
                    <div>
                      <p className="label">{t('stu.adTexts')}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {copies.map((a) => {
                          const m = a.meta as AdCopyResult | null;
                          return (
                            <div key={a.id} className="card group relative p-4">
                              <button
                                onClick={() => deleteAsset(a.id)}
                                className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-surface-2 text-faint opacity-0 transition hover:bg-red-600 hover:text-white group-hover:opacity-100"
                                title={t('stu.delete')}
                                aria-label={t('stu.delete')}
                              >
                                ✕
                              </button>
                              <p className="text-xs font-semibold text-brand-violet">{a.prompt}</p>
                              {m?.description && <p className="mt-1.5 text-sm">{m.description}</p>}
                              {m?.hashtags && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {m.hashtags.slice(0, 6).map((h) => (
                                    <span key={h} className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-brand-violet">#{h}</span>
                                  ))}
                                </div>
                              )}
                              <p className="mt-2 text-[10px] text-faint">
                                {a.provider === 'mock' ? t('common.simulated') : `✨ ${a.provider}`}
                              </p>
                            </div>
                          );
                        })}
                      </div>
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
