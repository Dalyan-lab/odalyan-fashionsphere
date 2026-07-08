'use client';

import { useState } from 'react';
import {
  AdTone,
  MannequinType,
  PhotoStyle,
  type AdCopyResult,
} from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import type { Product } from '@/lib/types';
import { Icon } from './icons';

export type StudioMode = 'mannequin' | 'adcopy';

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
            {mode === 'mannequin' ? 'Studio Mannequin IA' : 'Publicité IA'}
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
  const [productId, setProductId] = useState('');
  const [mannequinType, setMannequinType] = useState<MannequinType>(MannequinType.FEMME);
  const [style, setStyle] = useState<PhotoStyle>(PhotoStyle.STUDIO);
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const asset = await apiFetch<{ url: string; provider: string }>('/ai/mannequin', {
        method: 'POST',
        body: JSON.stringify({ productId: productId || undefined, mannequinType, style, prompt: prompt || undefined }),
      });
      setImages((prev) => [{ url: asset.url, provider: asset.provider }, ...prev]);
      onGenerated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de génération');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Générez des photos studio professionnelles à partir d’un produit. Choisissez le type de
        mannequin et le style.
      </p>

      {products.length > 0 && (
        <div>
          <label className="label">Produit (optionnel)</label>
          <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">— Sans produit —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Type de mannequin</label>
          <select className="input" value={mannequinType} onChange={(e) => setMannequinType(e.target.value as MannequinType)}>
            {Object.values(MannequinType).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Style</label>
          <select className="input" value={style} onChange={(e) => setStyle(e.target.value as PhotoStyle)}>
            {Object.values(PhotoStyle).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Prompt personnalisé (optionnel)</label>
        <textarea
          className="input min-h-[70px]"
          placeholder="Ex: mannequin marchant dans une rue parisienne au coucher du soleil…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      {error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{error}</p>}

      <button onClick={generate} disabled={loading} className="btn-primary w-full">
        {loading ? 'Génération en cours…' : <>{Icon.sparkles({ width: 16, height: 16 })} Générer une photo</>}
      </button>

      {images.length > 0 && (
        <div>
          <p className="label">Résultats</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((img, i) => (
              <div key={i} className="card overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="Généré" className="aspect-[3/4] w-full object-cover" />
                <p className="px-2 py-1 text-[10px] text-faint">
                  {img.provider === 'mock' ? '⚙️ simulé' : `✨ ${img.provider}`}
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
  const [productName, setProductName] = useState('');
  const [tone, setTone] = useState<AdTone>(AdTone.LUXE);
  const [result, setResult] = useState<AdCopyResult | null>(null);
  const [provider, setProvider] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!productName.trim()) {
      setError('Indiquez le nom du produit');
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
      setError(err instanceof Error ? err.message : 'Erreur de génération');
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Générez description, slogans, hashtags et appel à l’action.</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Nom du produit</label>
          <input
            className="input"
            list="produits"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Ex: Robe Wax Élégance"
          />
          <datalist id="produits">
            {products.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label">Ton</label>
          <select className="input" value={tone} onChange={(e) => setTone(e.target.value as AdTone)}>
            {Object.values(AdTone).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{error}</p>}

      <button onClick={generate} disabled={loading} className="btn-primary w-full">
        {loading ? 'Génération en cours…' : <>{Icon.sparkles({ width: 16, height: 16 })} Générer le texte</>}
      </button>

      {result && (
        <div className="space-y-3">
          <p className="text-right text-[10px] text-faint">
            {provider === 'mock' ? '⚙️ simulé' : `✨ ${provider}`}
          </p>
          <CopyBlock label="Description" onCopy={() => copy(result.description)}>
            <p className="text-sm">{result.description}</p>
          </CopyBlock>
          <CopyBlock label="Slogans" onCopy={() => copy(result.slogans.join('\n'))}>
            <ul className="space-y-1 text-sm">
              {result.slogans.map((s, i) => (
                <li key={i} className="flex gap-2"><span className="text-brand-coral">›</span> {s}</li>
              ))}
            </ul>
          </CopyBlock>
          <CopyBlock label="Hashtags" onCopy={() => copy(result.hashtags.map((h) => `#${h}`).join(' '))}>
            <div className="flex flex-wrap gap-1.5">
              {result.hashtags.map((h) => (
                <span key={h} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-brand-violet">#{h}</span>
              ))}
            </div>
          </CopyBlock>
          <CopyBlock label="Appel à l’action" onCopy={() => copy(result.cta)}>
            <p className="text-sm font-medium">{result.cta}</p>
          </CopyBlock>
        </div>
      )}
    </div>
  );
}

function CopyBlock({ label, onCopy, children }: { label: string; onCopy: () => void; children: React.ReactNode }) {
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
          {copied ? '✓ Copié' : 'Copier'}
        </button>
      </div>
      {children}
    </div>
  );
}
