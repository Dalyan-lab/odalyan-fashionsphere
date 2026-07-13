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
  const showName = shop.showNameOnBanner !== false;
  const showSlogan = shop.showSloganOnBanner !== false;
  const hasBanner = Boolean(shop.bannerUrl);

  return (
    <main>
      {/* Header de marque personnalisé */}
      <section
        className="relative overflow-hidden border-b border-border px-6 py-20 text-center"
        style={{
          background: hasBanner
            ? `url(${shop.bannerUrl}) center/cover`
            : `linear-gradient(135deg, ${accent}33, transparent)`,
        }}
      >
        {/* Voile sombre pour lisibilité du texte par-dessus la bannière */}
        {hasBanner && (showName || showSlogan || shop.description) && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />
        )}

        {/* Logo : en haut à gauche si bannière, sinon centré */}
        {shop.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shop.logoUrl}
            alt={shop.name}
            className={
              hasBanner
                ? 'absolute left-5 top-5 z-10 h-16 w-16 rounded-full border-2 border-white/80 object-cover shadow-lg'
                : 'mx-auto mb-4 h-20 w-20 rounded-full object-cover'
            }
          />
        )}

        <div className="relative z-10">
          {showName && (
            <h1
              className="font-display text-5xl font-bold drop-shadow-lg"
              style={{ color: hasBanner ? '#fff' : accent }}
            >
              {shop.name}
            </h1>
          )}
          {showSlogan && shop.slogan && (
            <p className={`mt-3 text-lg drop-shadow ${hasBanner ? 'text-white/90' : 'text-muted'}`}>
              {shop.slogan}
            </p>
          )}
          {shop.description && (
            <p className={`mx-auto mt-4 max-w-2xl text-sm ${hasBanner ? 'text-white/75' : 'text-faint'}`}>
              {shop.description}
            </p>
          )}
        </div>
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
