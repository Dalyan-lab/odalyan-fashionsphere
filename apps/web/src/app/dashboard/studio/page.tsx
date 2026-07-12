'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { AdCopyResult } from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Product } from '@/lib/types';
import { Topbar } from '@/components/dashboard/topbar';
import { Icon } from '@/components/dashboard/icons';
import { MannequinForm, AdCopyForm } from '@/components/dashboard/ai-studio-modal';

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

  const images = assets.filter((a) => a.url);
  const copies = assets.filter((a) => a.type === 'AD_COPY');

  return (
    <>
      <Topbar />
      <div className="p-6">
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
              <h2 className="mb-3 text-lg font-bold">{t('stu.gallery')} ({assets.length})</h2>
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
                          <div key={a.id} className="card overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={a.url!} alt="" className="aspect-[3/4] w-full object-cover" />
                            <p className="px-2 py-1 text-[10px] text-faint">
                              {a.provider === 'mock' ? t('common.simulated') : `✨ ${a.provider}`} ·{' '}
                              {new Date(a.createdAt).toLocaleDateString('fr-FR')}
                            </p>
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
                            <div key={a.id} className="card p-4">
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
