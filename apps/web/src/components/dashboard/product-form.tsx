'use client';

import { useState } from 'react';
import { ProductCategory } from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { ImageUploadInput } from './image-upload-input';

/**
 * Formulaire d'ajout de produit — composant unique réutilisé par
 * l'accueil du dashboard (état vide) et la page Produits.
 */
export function ProductForm({ onAdded, className = '' }: { onAdded: () => void; className?: string }) {
  const t = useT();
  const [form, setForm] = useState({
    name: '',
    price: '',
    category: ProductCategory.FEMME as ProductCategory,
    image: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          price: Number(form.price),
          category: form.category,
          status: 'ACTIVE',
          images: form.image ? [form.image] : [],
        }),
      });
      setForm({ name: '', price: '', category: ProductCategory.FEMME, image: '' });
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className={`card space-y-3 p-5 text-left ${className}`}>
      {error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{error}</p>}
      <div>
        <label className="label">{t('prod.name')}</label>
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </div>
      <div>
        <label className="label">{t('dh.price')}</label>
        <input className="input" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
      </div>
      <div>
        <label className="label">{t('prod.category')}</label>
        <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ProductCategory })}>
          {Object.values(ProductCategory).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <ImageUploadInput label={t('prod.image')} value={form.image} onChange={(url) => setForm({ ...form, image: url })} />
      <button className="btn-primary w-full" disabled={loading}>{loading ? '…' : t('common.add')}</button>
    </form>
  );
}
