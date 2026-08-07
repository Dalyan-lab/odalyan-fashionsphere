'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AvatarSex, BodyType, TRYON_ANGLES, TRYON_SIZES, type TryOnResult } from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Product } from '@/lib/types';
import { Topbar } from '@/components/dashboard/topbar';
import { WorkflowSteps } from '@/components/dashboard/workflow-steps';
import { AvatarPicker } from '@/components/dashboard/avatar-picker';
import { AttachToProduct } from '@/components/dashboard/attach-to-product';
import { ImageLightbox } from '@/components/dashboard/image-lightbox';
import { Icon } from '@/components/dashboard/icons';

export default function TryOnPage() {
  const t = useT();
  const [products, setProducts] = useState<Product[]>([]);
  const [noShop, setNoShop] = useState(false);
  const [productId, setProductId] = useState('');
  const [avatarSex, setAvatarSex] = useState<AvatarSex>(AvatarSex.FEMME);
  const [bodyType, setBodyType] = useState<BodyType>(BodyType.NORMALE);
  const [size, setSize] = useState<(typeof TRYON_SIZES)[number]>('M');
  const [avatarAssetId, setAvatarAssetId] = useState('');
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Product[]>('/products/mine')
      .then((p) => {
        setProducts(p);
        if (p[0]) setProductId(p[0].id);
      })
      .catch(() => setNoShop(true));
  }, []);

  // Persistance : recharge le dernier essayage sauvegardé quand on (re)vient sur un produit.
  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    apiFetch<TryOnResult | null>(`/ai/tryon/last?productId=${productId}`)
      .then((r) => {
        if (!cancelled) setResult(r ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const tryOn = async () => {
    if (!productId) {
      setError(t('tryon.selectProduct'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<TryOnResult>('/ai/tryon', {
        method: 'POST',
        body: JSON.stringify({ productId, avatarSex, bodyType, size, avatarAssetId: avatarAssetId || undefined }),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Topbar />
      <div className="p-6">
        <WorkflowSteps />
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-violet-magenta text-white">
            👗
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold">{t('dash.nav.tryon')}</h1>
            <p className="text-muted">{t('tryon.subtitle')}</p>
          </div>
          <span className="ml-3 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-bold text-brand-violet">
            Phase 3
          </span>
        </div>

        {noShop ? (
          <div className="card mt-6 p-10 text-center text-muted">
            {t('common.mustCreateShop')}
            <Link href="/dashboard" className="btn-primary mx-auto mt-4 block w-fit">{t('dh.createShop')}</Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
            {/* Contrôles */}
            <div className="card h-fit space-y-4 p-5">
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
              <div>
                <label className="label">{t('tryon.mannequin')}</label>
                <select className="input" value={avatarSex} onChange={(e) => setAvatarSex(e.target.value as AvatarSex)}>
                  {Object.values(AvatarSex).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">{t('tryon.shape')}</label>
                  <select className="input" value={bodyType} onChange={(e) => setBodyType(e.target.value as BodyType)}>
                    {Object.values(BodyType).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{t('tryon.size')}</label>
                  <select className="input" value={size} onChange={(e) => setSize(e.target.value as (typeof TRYON_SIZES)[number])}>
                    {TRYON_SIZES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-faint">{t('tryon.shapeHint')}</p>

              <div>
                <p className="label">{t('tryon.avatarOptional')}</p>
                <AvatarPicker value={avatarAssetId} onChange={setAvatarAssetId} />
              </div>

              {error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{error}</p>}

              <button onClick={tryOn} disabled={loading || products.length === 0} className="btn-primary w-full">
                {loading ? t('tryon.generating') : <>{Icon.sparkles({ width: 16, height: 16 })} {t('tryon.try')}</>}
              </button>
            </div>

            {/* Résultat */}
            <div>
              {loading ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {TRYON_ANGLES.map((a) => (
                    <div key={a} className="aspect-[3/5] animate-pulse rounded-xl bg-surface-2" />
                  ))}
                </div>
              ) : result ? (
                <>
                  <p className="mb-1 text-sm text-muted">
                    {t('tryon.renderOf')} <span className="font-semibold text-content">{result.productName}</span> — {result.views.length} {t('tryon.angles')}
                  </p>
                  <p className="mb-3 text-xs text-brand-violet">💡 {t('tryon.validateHint')}</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {result.views.map((v) => (
                      <div key={v.angle} className="card overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={v.url}
                          alt={v.angle}
                          className="aspect-[3/5] w-full cursor-zoom-in object-cover transition hover:opacity-90"
                          onClick={() => setZoomUrl(v.url)}
                          title={t('stu.zoomHint')}
                        />
                        <p className="bg-surface-2 py-1 text-center text-[11px] font-medium">{v.angle}</p>
                        <div className="p-1.5">
                          <AttachToProduct url={v.url} kind="image" />
                        </div>
                      </div>
                    ))}
                  </div>
                  {(() => {
                    const real = result.views.find((v) => v.provider !== 'mock' && v.provider !== 'product');
                    const someProductFallback = result.views.some((v) => v.provider === 'product');
                    return (
                      <p className="mt-3 text-[10px] text-faint">
                        {real ? `${t('common.generatedVia')} ${real.provider}` : t('common.mockNote')}
                        {someProductFallback && ` · ${t('tryon.someAnglesProduct')}`}
                      </p>
                    );
                  })()}
                </>
              ) : (
                <div className="card grid h-full min-h-[300px] place-items-center p-10 text-center text-muted">
                  <div>
                    <p className="text-4xl">👗</p>
                    <p className="mt-3">{t('tryon.emptyHint')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {zoomUrl && <ImageLightbox url={zoomUrl} onClose={() => setZoomUrl(null)} />}
    </>
  );
}
