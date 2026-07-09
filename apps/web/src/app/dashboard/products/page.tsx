'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Product } from '@/lib/types';
import { Topbar } from '@/components/dashboard/topbar';
import { ProductForm } from '@/components/dashboard/product-form';

export default function ProductsPage() {
  const t = useT();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [noShop, setNoShop] = useState(false);

  const load = async () => {
    try {
      setProducts(await apiFetch<Product[]>('/products/mine'));
      setNoShop(false);
    } catch {
      setNoShop(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <Topbar />
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">{t('prod.title')}</h1>
            <p className="text-muted">{t('prod.subtitle')}</p>
          </div>
        </div>

        {loading ? (
          <p className="text-muted">{t('common.loading')}</p>
        ) : noShop ? (
          <div className="card p-10 text-center text-muted">
            {t('common.mustCreateShop')}
            <Link href="/dashboard" className="btn-primary mx-auto mt-4 block w-fit">
              {t('dh.createShop')}
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <h2 className="mb-3 text-lg font-bold">{t('prod.myProducts')} ({products.length})</h2>
              <div className="space-y-3">
                {products.length === 0 && <p className="text-muted">{t('dh.noProducts')}</p>}
                {products.map((p) => (
                  <ProductRow key={p.id} product={p} onChanged={load} />
                ))}
              </div>
            </div>
            <div>
              <h2 className="mb-3 text-lg font-bold">{t('prod.addProduct')}</h2>
              <ProductForm onAdded={load} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ProductRow({ product, onChanged }: { product: Product; onChanged: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const del = async () => {
    if (!confirm(t('prod.confirmDelete'))) return;
    setBusy(true);
    await apiFetch(`/products/${product.id}`, { method: 'DELETE' }).catch(() => undefined);
    onChanged();
  };
  return (
    <div className="card flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.images[0] ?? 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=200'}
          alt=""
          className="h-14 w-14 rounded-lg object-cover"
        />
        <div>
          <p className="font-medium">{product.name}</p>
          <p className="text-xs text-faint">
            {product.category} · {Number(product.price).toFixed(2)} {product.currency} · {product.status}
          </p>
        </div>
      </div>
      <button onClick={del} disabled={busy} className="text-sm text-red-400 hover:text-red-300">
        {t('common.delete')}
      </button>
    </div>
  );
}

