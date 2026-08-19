'use client';

import { useEffect, useState } from 'react';
import {
  CATEGORY_LABELS,
  DEPARTMENT_LABELS,
  ProductCategory,
  ProductDepartment,
  categoriesOfDepartment,
} from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import type { MarketplaceResponse } from '@/lib/types';
import { ProductCard } from '@/components/product-card';
import { MarketplaceHero } from '@/components/marketplace-hero';
import { useT } from '@/lib/i18n';

const DEPARTMENTS = Object.values(ProductDepartment);

export default function MarketplacePage() {
  const t = useT();
  const [data, setData] = useState<MarketplaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // Navigation à deux niveaux : on choisit un rayon, puis éventuellement une
  // catégorie à l'intérieur. Sans catégorie, tout le rayon est affiché.
  const [department, setDepartment] = useState<ProductDepartment | ''>('');
  const [category, setCategory] = useState<ProductCategory | ''>('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    else if (department) params.set('department', department);
    if (search) params.set('search', search);
    apiFetch<MarketplaceResponse>(`/products?${params.toString()}`, { auth: false })
      .then(setData)
      .catch(() => setData({ items: [], total: 0, page: 1, pageSize: 24, totalPages: 0 }))
      .finally(() => setLoading(false));
  }, [department, category, search]);

  /** Change de rayon : la catégorie précédente n'a plus de sens, on la remet à zéro. */
  const pickDepartment = (dep: ProductDepartment | '') => {
    setDepartment(dep);
    setCategory('');
  };

  const label = (c: ProductCategory) => {
    const key = `cat.${c}`;
    const translated = t(key);
    return translated === key ? CATEGORY_LABELS[c] : translated;
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      {/* Le bandeau porte le titre de la page : sans campagne en cours, il
          affiche le titre et le sous-titre habituels, donc rien ne manque. */}
      <MarketplaceHero fallbackTitle={t('mp.title')} fallbackSubtitle={t('mp.subtitle')} />

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <input
          placeholder={t('mp.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input max-w-xs"
        />
        <button
          onClick={() => pickDepartment('')}
          className={`rounded-full px-4 py-2 text-sm ${
            department === '' ? 'bg-brand-gradient' : 'border border-border'
          }`}
        >
          {t('mp.all')}
        </button>
        {DEPARTMENTS.map((d) => (
          <button
            key={d}
            onClick={() => pickDepartment(d)}
            className={`rounded-full px-4 py-2 text-sm ${
              department === d ? 'bg-brand-gradient' : 'border border-border'
            }`}
          >
            {DEPARTMENT_LABELS[d]}
          </button>
        ))}
      </div>

      {/* Second niveau : les catégories du rayon choisi. */}
      {department && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCategory('')}
            className={`rounded-full px-3 py-1.5 text-xs ${
              category === '' ? 'border border-brand-violet text-content' : 'border border-border text-muted'
            }`}
          >
            {t('mp.allInDept')}
          </button>
          {categoriesOfDepartment(department).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1.5 text-xs ${
                category === c ? 'border border-brand-violet text-content' : 'border border-border text-muted'
              }`}
            >
              {label(c)}
            </button>
          ))}
        </div>
      )}

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
