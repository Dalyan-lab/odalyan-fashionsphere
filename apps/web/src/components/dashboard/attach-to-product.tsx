'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Product } from '@/lib/types';

/**
 * Bouton « Attacher à un produit » posé sur une création IA (image ou vidéo).
 * Ouvre la liste des produits du vendeur ; le clic ajoute l'URL de la création
 * aux images/videos du produit (PATCH /products/:id) → elle apparaît dans la
 * galerie de la fiche produit vue par les clients.
 */
export function AttachToProduct({ url, kind }: { url: string; kind: 'image' | 'video' }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [busy, setBusy] = useState('');
  const [done, setDone] = useState('');

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !products) {
      try {
        setProducts(await apiFetch<Product[]>('/products/mine'));
      } catch {
        setProducts([]);
      }
    }
  };

  const attach = async (p: Product) => {
    setBusy(p.id);
    try {
      const body =
        kind === 'video'
          ? { videos: [...(p.videos ?? []), url] }
          : { images: [...(p.images ?? []), url] };
      await apiFetch(`/products/${p.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      // garde l'état local à jour pour un éventuel 2e attachement
      setProducts((list) => list?.map((x) => (x.id === p.id ? ({ ...x, ...body } as Product) : x)) ?? null);
      setDone(p.name);
      setOpen(false);
      setTimeout(() => setDone(''), 2500);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="w-full rounded-lg border border-border px-2 py-1 text-[11px] text-muted transition hover:border-brand-violet hover:text-brand-violet"
      >
        📎 {t('prod.attach')}
      </button>

      {done && <p className="mt-1 text-[10px] text-emerald-500">✓ {t('prod.attachDone')} {done}</p>}

      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-1 max-h-52 w-56 overflow-auto rounded-xl border border-border bg-surface-1 p-1 shadow-xl">
          <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-faint">{t('prod.chooseProduct')}</p>
          {products === null ? (
            <p className="px-2 py-2 text-xs text-muted">{t('common.loading')}</p>
          ) : products.length === 0 ? (
            <p className="px-2 py-2 text-xs text-faint">{t('dh.noProducts')}</p>
          ) : (
            products.map((p) => (
              <button
                key={p.id}
                onClick={() => attach(p)}
                disabled={busy === p.id}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-surface-hover"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.images?.[0] ?? 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=80'}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded object-cover"
                />
                <span className="line-clamp-1">{busy === p.id ? '…' : p.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
