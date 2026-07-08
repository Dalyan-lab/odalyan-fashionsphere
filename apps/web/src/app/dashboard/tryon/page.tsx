'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AvatarSex, SkinTone, type TryOnResult } from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import type { Product } from '@/lib/types';
import { Topbar } from '@/components/dashboard/topbar';
import { Icon } from '@/components/dashboard/icons';

export default function TryOnPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [noShop, setNoShop] = useState(false);
  const [productId, setProductId] = useState('');
  const [avatarSex, setAvatarSex] = useState<AvatarSex>(AvatarSex.FEMME);
  const [skinTone, setSkinTone] = useState<SkinTone>(SkinTone.METISSE);
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<Product[]>('/products/mine')
      .then((p) => {
        setProducts(p);
        if (p[0]) setProductId(p[0].id);
      })
      .catch(() => setNoShop(true));
  }, []);

  const tryOn = async () => {
    if (!productId) {
      setError('Sélectionnez un produit');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<TryOnResult>('/ai/tryon', {
        method: 'POST',
        body: JSON.stringify({ productId, avatarSex, skinTone }),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’essayage');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Topbar />
      <div className="p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-violet-magenta text-white">
            👗
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold">Essayage virtuel</h1>
            <p className="text-muted">Visualisez un vêtement sur un mannequin sous tous les angles.</p>
          </div>
          <span className="ml-3 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-bold text-brand-violet">
            Phase 3
          </span>
        </div>

        {noShop ? (
          <div className="card mt-6 p-10 text-center text-muted">
            Vous devez d’abord créer votre boutique.
            <Link href="/dashboard" className="btn-primary mx-auto mt-4 block w-fit">Créer ma boutique</Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
            {/* Contrôles */}
            <div className="card h-fit space-y-4 p-5">
              <div>
                <label className="label">Produit</label>
                {products.length === 0 ? (
                  <p className="text-sm text-muted">Aucun produit. <Link href="/dashboard/products" className="text-brand-violet hover:underline">Ajoutez-en un</Link>.</p>
                ) : (
                  <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="label">Mannequin</label>
                <select className="input" value={avatarSex} onChange={(e) => setAvatarSex(e.target.value as AvatarSex)}>
                  {Object.values(AvatarSex).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Teint</label>
                <select className="input" value={skinTone} onChange={(e) => setSkinTone(e.target.value as SkinTone)}>
                  {Object.values(SkinTone).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{error}</p>}

              <button onClick={tryOn} disabled={loading || products.length === 0} className="btn-primary w-full">
                {loading ? 'Génération des vues…' : <>{Icon.sparkles({ width: 16, height: 16 })} Essayer</>}
              </button>
            </div>

            {/* Résultat */}
            <div>
              {loading ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="aspect-[3/5] animate-pulse rounded-xl bg-surface-2" />
                  ))}
                </div>
              ) : result ? (
                <>
                  <p className="mb-3 text-sm text-muted">
                    Rendu de <span className="font-semibold text-content">{result.productName}</span> sous {result.views.length} angles :
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {result.views.map((v) => (
                      <div key={v.angle} className="card overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={v.url} alt={v.angle} className="aspect-[3/5] w-full object-cover" />
                        <p className="bg-surface-2 py-1 text-center text-[11px] font-medium">{v.angle}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] text-faint">
                    {result.views[0]?.provider === 'mock' ? '⚙️ Rendu simulé (sans clé OpenAI)' : `✨ Généré via ${result.views[0]?.provider}`}
                  </p>
                </>
              ) : (
                <div className="card grid h-full min-h-[300px] place-items-center p-10 text-center text-muted">
                  <div>
                    <p className="text-4xl">👗</p>
                    <p className="mt-3">Choisissez un produit et cliquez sur « Essayer » pour générer les 5 vues.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
