'use client';

import { use, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { Shop } from '@/lib/types';
import { ProductCard } from '@/components/product-card';

export default function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [shop, setShop] = useState<Shop | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    apiFetch<Shop>(`/shops/public/${slug}`, { auth: false })
      .then(setShop)
      .catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) return <main className="mx-auto max-w-7xl px-6 py-20 text-muted">Boutique introuvable.</main>;
  if (!shop) return <main className="mx-auto max-w-7xl px-6 py-20 text-muted">Chargement…</main>;

  const accent = shop.primaryColor ?? '#C9A227';

  return (
    <main>
      {/* Header de marque personnalisé */}
      <section
        className="relative overflow-hidden border-b border-border px-6 py-20 text-center"
        style={{
          background: shop.bannerUrl
            ? `url(${shop.bannerUrl}) center/cover`
            : `linear-gradient(135deg, ${accent}33, transparent)`,
        }}
      >
        {shop.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.logoUrl} alt={shop.name} className="mx-auto mb-4 h-20 w-20 rounded-full object-cover" />
        )}
        <h1 className="font-display text-5xl font-bold" style={{ color: accent }}>
          {shop.name}
        </h1>
        {shop.slogan && <p className="mt-3 text-lg text-muted">{shop.slogan}</p>}
        {shop.description && (
          <p className="mx-auto mt-4 max-w-2xl text-sm text-faint">{shop.description}</p>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <h2 className="font-display text-2xl font-bold">Collection</h2>
        {shop.products && shop.products.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {shop.products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <p className="mt-8 text-faint">Cette boutique n’a pas encore de produits.</p>
        )}
      </section>
    </main>
  );
}
