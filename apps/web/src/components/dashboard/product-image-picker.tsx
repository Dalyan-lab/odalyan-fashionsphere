'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Product } from '@/lib/types';

/**
 * Sélecteur d'image depuis le catalogue (produits boutique + affiliés Amazon).
 * Renvoie l'URL de la première image du produit choisi. Réutilisé par Studio,
 * Avatars et Vidéo pour alimenter la génération IA à partir de vraies photos.
 */
export function ProductImagePicker({
  value,
  onPick,
}: {
  value?: string;
  onPick: (url: string, product: Product) => void;
}) {
  const t = useT();
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    apiFetch<Product[]>('/products/mine')
      .then((list) => setProducts(list.filter((p) => p.images?.length)))
      .catch(() => setProducts([]));
  }, []);

  if (products.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm transition hover:border-brand-violet"
      >
        <span className="flex items-center gap-2">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-8 w-8 rounded object-cover" />
          ) : (
            <span aria-hidden>🖼️</span>
          )}
          {value ? t('picker.selected') : t('picker.chooseFromCatalog')}
        </span>
        <span className="text-faint">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-2 grid max-h-56 grid-cols-3 gap-2 overflow-y-auto rounded-xl border border-border bg-surface p-2 scrollbar-thin sm:grid-cols-4">
          {products.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => {
                onPick(p.images[0]!, p);
                setOpen(false);
              }}
              className={`group overflow-hidden rounded-lg border transition ${
                value === p.images[0] ? 'border-brand-violet ring-1 ring-brand-violet/40' : 'border-border hover:border-brand-violet'
              }`}
              title={p.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.images[0]} alt={p.name} className="aspect-square w-full object-cover" />
              <span className="block truncate px-1 py-0.5 text-[9px] text-faint">
                {p.affiliateUrl ? '🔗 ' : ''}
                {p.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
