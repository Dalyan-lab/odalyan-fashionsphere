'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useCart } from '@/lib/store';
import { convertAndFormat, useLocale } from '@/lib/i18n';
import { ProductReviews } from '@/components/product-reviews';
import { ImageLightbox } from '@/components/dashboard/image-lightbox';
import type { Product, Variant } from '@/lib/types';

const FALLBACK = 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800';

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const add = useCart((s) => s.add);
  const displayCurrency = useLocale((s) => s.currency);
  const [product, setProduct] = useState<Product | null>(null);
  const [variant, setVariant] = useState<Variant | null>(null);
  const [added, setAdded] = useState(false);
  const [active, setActive] = useState(0);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Product>(`/products/${id}`, { auth: false })
      .then((p) => {
        setProduct(p);
        setVariant(p.variants?.[0] ?? null);
        setActive(0);
      })
      .catch(() => setProduct(null));
  }, [id]);

  if (!product) return <main className="mx-auto max-w-7xl px-6 py-20 text-muted">Chargement…</main>;

  // Galerie : toutes les images (photos + rendus mannequin IA) puis les vidéos
  const media: { type: 'image' | 'video'; url: string }[] = [
    ...product.images.map((url) => ({ type: 'image' as const, url })),
    ...product.videos.map((url) => ({ type: 'video' as const, url })),
  ];
  const current = media[active] ?? { type: 'image' as const, url: FALLBACK };
  const coverImage = product.images[0] ?? FALLBACK;
  const price = variant?.priceOverride ? Number(variant.priceOverride) : Number(product.price);

  const handleAdd = () => {
    add({
      productId: product.id,
      variantId: variant?.id,
      name: product.name,
      price,
      image: coverImage,
      quantity: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <>
    <main className="mx-auto grid max-w-7xl gap-12 px-6 py-12 md:grid-cols-2">
      {/* Galerie média : visionneuse + miniatures */}
      <div>
        <div className="card overflow-hidden">
          {current.type === 'video' ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={current.url} controls playsInline className="aspect-[3/4] w-full bg-black object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.url}
              alt={product.name}
              className="aspect-[3/4] w-full cursor-zoom-in object-cover"
              onClick={() => setZoomUrl(current.url)}
              title="Cliquer pour agrandir"
            />
          )}
        </div>

        {media.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {media.map((m, i) => (
              <button
                key={`${m.type}-${i}`}
                onClick={() => setActive(i)}
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                  i === active ? 'border-brand-violet' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                {m.type === 'video' ? (
                  <>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video src={`${m.url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full bg-black object-cover" />
                    <span className="absolute inset-0 grid place-items-center text-lg">▶️</span>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt="" className="h-full w-full object-cover" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        {product.shop && (
          <Link
            href={`/shop/${product.shop.slug}`}
            className="inline-flex items-center gap-2 text-sm uppercase tracking-wide text-faint hover:text-brand-violet"
          >
            {product.shop.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.shop.logoUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
            )}
            {product.shop.name} · Voir la boutique →
          </Link>
        )}
        <h1 className="mt-2 font-display text-4xl font-bold">{product.name}</h1>
        <p className="mt-4 font-display text-3xl font-bold text-brand-coral">
          {convertAndFormat(price, product.currency, displayCurrency)}
        </p>
        {product.description && <p className="mt-6 text-muted">{product.description}</p>}

        {product.shop && (product.shop.deliveryDaysMin != null || product.shop.deliveryDaysMax != null) && (
          <p className="mt-4 flex items-start gap-2 text-sm text-muted">
            <span aria-hidden>🚚</span>
            <span>
              Livraison sous{' '}
              <strong className="text-content">
                {product.shop.deliveryDaysMin != null &&
                product.shop.deliveryDaysMax != null &&
                product.shop.deliveryDaysMin !== product.shop.deliveryDaysMax
                  ? `${product.shop.deliveryDaysMin} à ${product.shop.deliveryDaysMax} jours`
                  : `${product.shop.deliveryDaysMax ?? product.shop.deliveryDaysMin} jours`}
              </strong>
              {product.shop.deliveryNote && (
                <span className="block text-xs text-faint">{product.shop.deliveryNote}</span>
              )}
            </span>
          </p>
        )}

        {product.variants && product.variants.length > 0 && (
          <div className="mt-8">
            <p className="label">Variantes</p>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVariant(v)}
                  className={`rounded-xl border px-4 py-2 text-sm ${
                    variant?.id === v.id ? 'border-roseGold bg-surface-2' : 'border-border'
                  }`}
                >
                  {v.size} · {v.color}
                  <span className="ml-2 text-xs text-faint">({v.stock})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {product.affiliateUrl ? (
          <div className="mt-10">
            <a
              href={product.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="btn-primary inline-flex items-center gap-2"
            >
              🛒 Voir sur Amazon
            </a>
            <p className="mt-2 text-xs text-faint">
              Produit partenaire — l’achat se fait sur {product.sourceMarketplace ?? 'Amazon'}.
            </p>
          </div>
        ) : (
          <div className="mt-10 flex gap-4">
            <button onClick={handleAdd} className="btn-primary">
              {added ? '✓ Ajouté' : 'Ajouter au panier'}
            </button>
            <button onClick={() => router.push('/cart')} className="btn-ghost">
              Voir le panier
            </button>
          </div>
        )}

        {/* Indices de médias enrichis (mannequin IA / vidéo) attachés au produit */}
        {(product.videos.length > 0 || product.images.length > 1) && (
          <div className="mt-8 flex flex-wrap gap-2 text-xs">
            {product.images.length > 1 && (
              <span className="rounded-full bg-surface-2 px-3 py-1 text-brand-violet">🎭 Vues mannequin & détails</span>
            )}
            {product.videos.length > 0 && (
              <span className="rounded-full bg-surface-2 px-3 py-1 text-brand-magenta">🎬 Vidéo du produit</span>
            )}
          </div>
        )}
      </div>
    </main>
    <ProductReviews productId={product.id} />
    {zoomUrl && <ImageLightbox url={zoomUrl} onClose={() => setZoomUrl(null)} />}
    </>
  );
}
