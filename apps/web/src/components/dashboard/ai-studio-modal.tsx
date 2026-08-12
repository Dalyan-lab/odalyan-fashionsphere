'use client';

import { useEffect, useState } from 'react';
import {
  AdTone,
  MannequinType,
  PRODUCT_SCENE_LABELS,
  PhotoStyle,
  ProductScene,
  type AdCopyResult,
} from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Product } from '@/lib/types';
import { Icon } from './icons';
import { ProductImagePicker } from './product-image-picker';

export type StudioMode = 'mannequin' | 'product' | 'adcopy';

interface GeneratedImage {
  url: string;
  provider: string;
}

export function AiStudioModal({
  mode,
  products,
  onClose,
}: {
  mode: StudioMode;
  products: Product[];
  onClose: () => void;
}) {
  const t = useT();
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto scrollbar-thin p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
            <span className="text-brand-violet">{Icon.sparkles({})}</span>
            {mode === 'mannequin' ? t('aim.mannequinTitle') : t('dh.tool.adcopy')}
          </h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted hover:bg-surface-hover">
            ✕
          </button>
        </div>

        {mode === 'mannequin' ? (
          <MannequinForm products={products} />
        ) : (
          <AdCopyForm products={products} />
        )}
      </div>
    </div>
  );
}

export function MannequinForm({ products, onGenerated }: { products: Product[]; onGenerated?: () => void }) {
  const t = useT();
  const [productId, setProductId] = useState('');
  const [sourceImageUrl, setSourceImageUrl] = useState('');
  const [mannequinType, setMannequinType] = useState<MannequinType>(MannequinType.FEMME);
  const [style, setStyle] = useState<PhotoStyle>(PhotoStyle.STUDIO);
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [avatars, setAvatars] = useState<{ id: string; url: string | null }[]>([]);
  const [avatarAssetId, setAvatarAssetId] = useState('');
  const [garmentCategory, setGarmentCategory] = useState<'upper_body' | 'lower_body' | 'dresses'>('upper_body');

  useEffect(() => {
    apiFetch<{ id: string; url: string | null }[]>('/ai/assets?type=AVATAR')
      .then((list) => setAvatars(list.filter((a) => a.url)))
      .catch(() => setAvatars([]));
  }, []);

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const asset = await apiFetch<{ url: string; provider: string }>('/ai/mannequin', {
        method: 'POST',
        body: JSON.stringify({
          productId: productId || undefined,
          sourceImageUrl: sourceImageUrl || undefined,
          avatarAssetId: avatarAssetId || undefined,
          garmentCategory: avatarAssetId ? garmentCategory : undefined,
          mannequinType,
          style,
          prompt: prompt || undefined,
        }),
      });
      setImages((prev) => [{ url: asset.url, provider: asset.provider }, ...prev]);
      onGenerated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t('aim.mannequinIntro')}</p>

      {products.length > 0 && (
        <div>
          <label className="label">{t('aim.productOptional')}</label>
          <select
            className="input"
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              const p = products.find((x) => x.id === e.target.value);
              setSourceImageUrl(p?.images?.[0] ?? '');
            }}
          >
            <option value="">{t('aim.noProduct')}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Import de la photo produit depuis le catalogue → génération image→image */}
      <div>
        <label className="label">{t('aim.importPhoto')}</label>
        <ProductImagePicker
          value={sourceImageUrl || undefined}
          onPick={(url, p) => {
            setSourceImageUrl(url);
            setProductId(p.id);
          }}
        />
        {avatars.length > 0 && (
          <div className="mt-3">
            <label className="label">{t('aim.dressAvatar')}</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAvatarAssetId('')}
                className={`grid h-16 w-16 place-items-center rounded-lg border text-[10px] ${
                  avatarAssetId === '' ? 'border-brand-violet text-brand-violet' : 'border-border text-faint'
                }`}
              >
                {t('aim.noAvatar')}
              </button>
              {avatars.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAvatarAssetId(a.id)}
                  className={`h-16 w-16 overflow-hidden rounded-lg border-2 transition ${
                    avatarAssetId === a.id ? 'border-brand-violet' : 'border-transparent opacity-75 hover:opacity-100'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url ?? ''} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
            {avatarAssetId && (
              <div className="mt-2">
                <label className="label">{t('aim.garmentType')}</label>
                <select
                  className="input"
                  value={garmentCategory}
                  onChange={(e) => setGarmentCategory(e.target.value as typeof garmentCategory)}
                >
                  <option value="upper_body">{t('aim.garmentUpper')}</option>
                  <option value="lower_body">{t('aim.garmentLower')}</option>
                  <option value="dresses">{t('aim.garmentDress')}</option>
                </select>
                <p className="mt-1 text-[10px] text-brand-violet">✨ {t('aim.avatarDressed')}</p>
                <p className="mt-0.5 text-[10px] text-faint">{t('aim.tryOnHint')}</p>
              </div>
            )}
          </div>
        )}

        {sourceImageUrl && (
          <p className="mt-1 flex items-center gap-2 text-[10px] text-brand-violet">
            ✨ {t('aim.willUsePhoto')}
            <button type="button" onClick={() => setSourceImageUrl('')} className="text-faint hover:text-content">
              ✕ {t('aim.clearPhoto')}
            </button>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{t('aim.mannequinType')}</label>
          <select className="input" value={mannequinType} onChange={(e) => setMannequinType(e.target.value as MannequinType)}>
            {Object.values(MannequinType).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t('aim.style')}</label>
          <select className="input" value={style} onChange={(e) => setStyle(e.target.value as PhotoStyle)}>
            {Object.values(PhotoStyle).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">{t('aim.customPrompt')}</label>
        <textarea
          className="input min-h-[70px]"
          placeholder={t('aim.promptPh')}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      {error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{error}</p>}

      <button onClick={generate} disabled={loading} className="btn-primary w-full">
        {loading ? t('common.generating') : <>{Icon.sparkles({ width: 16, height: 16 })} {t('aim.generatePhoto')}</>}
      </button>

      {images.length > 0 && (
        <div>
          <p className="label">{t('aim.results')}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((img, i) => (
              <div key={i} className="card overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="aspect-[3/4] w-full object-cover" />
                <p className="px-2 py-1 text-[10px] text-faint">
                  {img.provider === 'mock' ? t('common.simulated') : `✨ ${img.provider}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Studio photo produit : remet en scène l'article dans un décor choisi.
 *
 * Destiné aux rayons où l'essayage virtuel n'a pas de sens — on ne fait pas
 * porter une casserole. Quand une photo du produit existe, la génération part
 * d'elle : le vendeur doit retrouver SON produit, avec un meilleur décor.
 */
export function ProductShotForm({ products, onGenerated }: { products: Product[]; onGenerated?: () => void }) {
  const t = useT();
  const [productId, setProductId] = useState('');
  const [productName, setProductName] = useState('');
  const [sourceImageUrl, setSourceImageUrl] = useState('');
  const [scene, setScene] = useState<ProductScene>(ProductScene.FOND_BLANC);
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const asset = await apiFetch<{ url: string; provider: string }>('/ai/product-shot', {
        method: 'POST',
        body: JSON.stringify({
          productId: productId || undefined,
          productName: productName.trim() || undefined,
          sourceImageUrl: sourceImageUrl || undefined,
          scene,
          prompt: prompt.trim() || undefined,
        }),
      });
      setImages((prev) => [{ url: asset.url, provider: asset.provider }, ...prev]);
      onGenerated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t('aim.productShotIntro')}</p>

      {products.length > 0 && (
        <div>
          <label className="label">{t('aim.productOptional')}</label>
          <select
            className="input"
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              const p = products.find((x) => x.id === e.target.value);
              setSourceImageUrl(p?.images?.[0] ?? '');
            }}
          >
            <option value="">{t('aim.noProduct')}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {!productId && (
        <div>
          <label className="label">{t('aim.productShotNameLabel')}</label>
          <input
            className="input"
            placeholder={t('aim.productShotNamePh')}
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
          />
        </div>
      )}

      <div>
        <label className="label">{t('aim.importPhoto')}</label>
        <ProductImagePicker
          value={sourceImageUrl || undefined}
          onPick={(url, p) => {
            setSourceImageUrl(url);
            setProductId(p.id);
          }}
        />
        <p className="mt-1 text-xs text-faint">{t('aim.productShotPhotoHint')}</p>
      </div>

      <div>
        <label className="label">{t('aim.scene')}</label>
        <select className="input" value={scene} onChange={(e) => setScene(e.target.value as ProductScene)}>
          {Object.values(ProductScene).map((s) => (
            <option key={s} value={s}>{PRODUCT_SCENE_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">{t('aim.customPrompt')}</label>
        <textarea
          className="input min-h-[70px]"
          placeholder={t('aim.promptPh')}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      {error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{error}</p>}

      <button onClick={generate} disabled={loading} className="btn-primary w-full">
        {loading ? t('common.generating') : <>{Icon.sparkles({ width: 16, height: 16 })} {t('aim.generatePhoto')}</>}
      </button>

      {images.length > 0 && (
        <div>
          <p className="label">{t('aim.results')}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((img, i) => (
              <div key={i} className="card overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="aspect-[3/4] w-full object-cover" />
                <p className="px-2 py-1 text-[10px] text-faint">
                  {img.provider === 'mock' ? t('common.simulated') : `✨ ${img.provider}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdCopyForm({ products, onGenerated }: { products: Product[]; onGenerated?: () => void }) {
  const t = useT();
  const [productName, setProductName] = useState('');
  const [tone, setTone] = useState<AdTone>(AdTone.LUXE);
  const [result, setResult] = useState<AdCopyResult | null>(null);
  const [provider, setProvider] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!productName.trim()) {
      setError(t('aim.nameRequired'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ result: AdCopyResult; asset: { provider: string } }>('/ai/ad-copy', {
        method: 'POST',
        body: JSON.stringify({ productName, tone }),
      });
      setResult(res.result);
      setProvider(res.asset.provider);
      onGenerated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t('aim.adIntro')}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">{t('dh.productName')}</label>
          <input
            className="input"
            list="produits"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder={t('aim.productNamePh')}
          />
          <datalist id="produits">
            {products.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label">{t('aim.tone')}</label>
          <select className="input" value={tone} onChange={(e) => setTone(e.target.value as AdTone)}>
            {Object.values(AdTone).map((tn) => (
              <option key={tn} value={tn}>{tn}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{error}</p>}

      <button onClick={generate} disabled={loading} className="btn-primary w-full">
        {loading ? t('common.generating') : <>{Icon.sparkles({ width: 16, height: 16 })} {t('aim.generateText')}</>}
      </button>

      {result && (
        <div className="space-y-3">
          <p className="text-right text-[10px] text-faint">
            {provider === 'mock' ? t('common.simulated') : `✨ ${provider}`}
          </p>
          <CopyBlock label={t('aim.description')} onCopy={() => copy(result.description)}>
            <p className="text-sm">{result.description}</p>
          </CopyBlock>
          <CopyBlock label={t('aim.slogans')} onCopy={() => copy(result.slogans.join('\n'))}>
            <ul className="space-y-1 text-sm">
              {result.slogans.map((s, i) => (
                <li key={i} className="flex gap-2"><span className="text-brand-coral">›</span> {s}</li>
              ))}
            </ul>
          </CopyBlock>
          <CopyBlock label={t('aim.hashtags')} onCopy={() => copy(result.hashtags.map((h) => `#${h}`).join(' '))}>
            <div className="flex flex-wrap gap-1.5">
              {result.hashtags.map((h) => (
                <span key={h} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-brand-violet">#{h}</span>
              ))}
            </div>
          </CopyBlock>
          <CopyBlock label={t('aim.cta')} onCopy={() => copy(result.cta)}>
            <p className="text-sm font-medium">{result.cta}</p>
          </CopyBlock>
        </div>
      )}
    </div>
  );
}

function CopyBlock({ label, onCopy, children }: { label: string; onCopy: () => void; children: React.ReactNode }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const handle = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className="card-2 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-faint">{label}</span>
        <button onClick={handle} className="text-xs text-brand-violet hover:underline">
          {copied ? t('aim.copied') : t('aim.copy')}
        </button>
      </div>
      {children}
    </div>
  );
}
