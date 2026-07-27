'use client';

import { use, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Shop } from '@/lib/types';
import { ProductCard } from '@/components/product-card';

const LOGO_POS: Record<string, string> = {
  'top-left': 'top-5 left-5',
  'top-right': 'top-5 right-5',
  'bottom-left': 'bottom-5 left-5',
  'bottom-right': 'bottom-5 right-5',
};

export default function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const t = useT();
  const [shop, setShop] = useState<Shop | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [cat, setCat] = useState<string>('ALL');

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
  const logoPos = LOGO_POS[shop.logoPosition ?? 'top-left'];
  const bannerVPos = shop.bannerPosition ?? 'center';

  // Produits regroupés en collections par catégorie (ordre d'apparition)
  const products = shop.products ?? [];
  const categories = Array.from(new Set(products.map((p) => p.category)));

  return (
    <main>
      {/* Header de marque personnalisé */}
      <section
        className="relative overflow-hidden border-b border-border px-6 py-20 text-center"
        style={
          hasBanner
            ? {
                backgroundImage: `url(${shop.bannerUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: `center ${bannerVPos}`,
              }
            : { background: `linear-gradient(135deg, ${accent}33, transparent)` }
        }
      >
        {/* Voile sombre pour lisibilité du texte par-dessus la bannière */}
        {hasBanner && (showName || showSlogan || shop.description) && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />
        )}

        {/* Logo : au coin choisi si bannière, sinon centré */}
        {shop.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shop.logoUrl}
            alt={shop.name}
            className={
              hasBanner
                ? `absolute ${logoPos} z-20 h-16 w-16 rounded-full border-2 border-white/80 object-cover shadow-lg`
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

      {/* Vidéo de présentation de la boutique */}
      {shop.videoUrl && (
        <section className="mx-auto max-w-4xl px-6 pt-10">
          <div className="overflow-hidden rounded-2xl border border-border bg-black shadow-lg">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={shop.videoUrl}
              controls
              playsInline
              className="max-h-[70vh] w-full bg-black object-contain"
            />
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-6 py-12">
        {products.length === 0 ? (
          <>
            <h2 className="font-display text-2xl font-bold">{t('shopfront.collection')}</h2>
            <p className="mt-8 text-faint">{t('shopfront.empty')}</p>
          </>
        ) : (
          <>
            {/* Filtres : vue d'ensemble + une collection par catégorie */}
            <div className="flex flex-wrap gap-2">
              <FilterChip label={t('shopfront.overview')} active={cat === 'ALL'} onClick={() => setCat('ALL')} />
              {categories.map((c) => (
                <FilterChip
                  key={c}
                  label={`${t(`cat.${c}`)} (${products.filter((p) => p.category === c).length})`}
                  active={cat === c}
                  onClick={() => setCat(c)}
                  accent={accent}
                />
              ))}
            </div>

            {cat === 'ALL' ? (
              // Vue d'ensemble : une section « collection » par catégorie
              <div className="mt-8 space-y-12">
                {categories.map((c) => (
                  <div key={c}>
                    <h2 className="font-display text-2xl font-bold" style={{ color: accent }}>
                      {t(`cat.${c}`)}
                    </h2>
                    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                      {products
                        .filter((p) => p.category === c)
                        .map((p) => (
                          <ProductCard key={p.id} product={p} />
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Filtré sur une seule catégorie
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {products
                  .filter((p) => p.category === cat)
                  .map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

/** Puce de filtre de collection (vue d'ensemble / catégorie). */
function FilterChip({
  label,
  active,
  onClick,
  accent,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  accent?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
        active ? 'border-transparent text-white' : 'border-border text-muted hover:bg-surface-hover'
      }`}
      style={active ? { background: accent ?? 'var(--brand-violet, #7c3aed)' } : undefined}
    >
      {label}
    </button>
  );
}
