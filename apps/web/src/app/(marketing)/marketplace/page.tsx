'use client';

import { useEffect, useState } from 'react';
import { ProductCategory } from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import type { MarketplaceResponse } from '@/lib/types';
import { ProductCard } from '@/components/product-card';
import { useT } from '@/lib/i18n';

const CATEGORIES = Object.values(ProductCategory);

export default function MarketplacePage() {
  const t = useT();
  const [data, setData] = useState<MarketplaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<ProductCategory | ''>('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    apiFetch<MarketplaceResponse>(`/products?${params.toString()}`, { auth: false })
      .then(setData)
      .catch(() => setData({ items: [], total: 0, page: 1, pageSize: 24, totalPages: 0 }))
      .finally(() => setLoading(false));
  }, [category, search]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="font-display text-4xl font-bold">{t('mp.title')}</h1>
      <p className="mt-2 text-muted">{t('mp.subtitle')}</p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <input
          placeholder={t('mp.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input max-w-xs"
        />
        <button
          onClick={() => setCategory('')}
          className={`rounded-full px-4 py-2 text-sm ${
            category === '' ? 'bg-brand-gradient' : 'border border-border'
          }`}
        >
          {t('mp.all')}
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full px-4 py-2 text-sm ${
              category === c ? 'bg-brand-gradient' : 'border border-border'
            }`}
          >
            {t(`cat.${c}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-12 text-faint">{t('mp.loading')}</p>
      ) : data && data.items.length > 0 ? (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {data.items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="card mt-12 p-12 text-center text-muted">{t('mp.empty')}</div>
      )}
    </main>
  );
}
