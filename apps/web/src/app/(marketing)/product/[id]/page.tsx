'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useCart } from '@/lib/store';
import { convertAndFormat, useLocale } from '@/lib/i18n';
import type { Product, Variant } from '@/lib/types';

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const add = useCart((s) => s.add);
  const displayCurrency = useLocale((s) => s.currency);
  const [product, setProduct] = useState<Product | null>(null);
  const [variant, setVariant] = useState<Variant | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    apiFetch<Product>(`/products/${id}`, { auth: false })
      .then((p) => {
        setProduct(p);
        setVariant(p.variants?.[0] ?? null);
      })
      .catch(() => setProduct(null));
  }, [id]);

  if (!product) return <main className="mx-auto max-w-7xl px-6 py-20 text-muted">Chargement…</main>;

  const image = product.images[0] ?? 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800';
  const price = variant?.priceOverride ? Number(variant.priceOverride) : Number(product.price);

  const handleAdd = () => {
    add({
      productId: product.id,
      variantId: variant?.id,
      name: product.name,
      price,
      image,
      quantity: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <main className="mx-auto grid max-w-7xl gap-12 px-6 py-12 md:grid-cols-2">
      <div className="card overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={product.name} className="aspect-[3/4] w-full object-cover" />
      </div>

      <div>
        {product.shop && (
          <p className="text-sm uppercase tracking-wide text-faint">{product.shop.name}</p>
        )}
        <h1 className="mt-2 font-display text-4xl font-bold">{product.name}</h1>
        <p className="mt-4 font-display text-3xl font-bold text-brand-coral">
          {convertAndFormat(price, product.currency, displayCurrency)}
        </p>
        {product.description && <p className="mt-6 text-muted">{product.description}</p>}

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

        <div className="mt-10 flex gap-4">
          <button onClick={handleAdd} className="btn-primary">
            {added ? '✓ Ajouté' : 'Ajouter au panier'}
          </button>
          <button onClick={() => router.push('/cart')} className="btn-ghost">
            Voir le panier
          </button>
        </div>

        {/* Emplacements pour les modules IA des phases suivantes */}
        <div className="mt-10 grid grid-cols-2 gap-3 text-sm text-faint">
          <div className="card p-4 opacity-60">🧍 Essayer sur mon avatar — Phase 3</div>
          <div className="card p-4 opacity-60">🌀 Voir en 3D 360° — Phase 3</div>
          <div className="card p-4 opacity-60">🎭 Voir sur mannequin IA — Phase 2</div>
          <div className="card p-4 opacity-60">🎬 Générer une vidéo — Phase 4</div>
        </div>
      </div>
    </main>
  );
}
