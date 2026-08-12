'use client';

import { useState } from 'react';
import { ProductCategory, ProductStatus } from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Product } from '@/lib/types';
import { CategorySelect } from './category-select';

/**
 * Édition rapide d'un produit (nom, prix, catégorie, statut) via PATCH /products/:id.
 * Notamment : recatégoriser un produit pour qu'il s'affiche dans la bonne collection.
 */
export function ProductEditor({ product, onSaved }: { product: Product; onSaved: () => void }) {
  const t = useT();
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price));
  const [category, setCategory] = useState<ProductCategory>(product.category as ProductCategory);
  const [status, setStatus] = useState<ProductStatus>(product.status as ProductStatus);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch(`/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, price: Number(price), category, status }),
      });
      setMsg({ ok: true, text: t('prod.editSaved') });
      onSaved();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : t('common.error') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 grid gap-3 rounded-xl border border-border bg-surface-2/40 p-4 sm:grid-cols-2">
      <div>
        <label className="label">{t('prod.name')}</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label">{t('dh.price')}</label>
        <input className="input" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <div>
        <label className="label">{t('prod.category')}</label>
        <CategorySelect value={category} onChange={setCategory} />
      </div>
      <div>
        <label className="label">{t('prod.status')}</label>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)}>
          {Object.values(ProductStatus).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button onClick={save} disabled={busy} className="btn-primary text-sm">
          {busy ? '…' : t('common.save')}
        </button>
        {msg && <span className={`text-xs ${msg.ok ? 'text-emerald-500' : 'text-red-400'}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
