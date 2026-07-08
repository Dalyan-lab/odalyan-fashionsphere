'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { Product } from '@/lib/types';
import { convertAndFormat, useLocale, useT } from '@/lib/i18n';

export function ProductCard({ product }: { product: Product }) {
  const currency = useLocale((s) => s.currency);
  const t = useT();
  const image = product.images[0] ?? 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800';

  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 300 }}
      className="card overflow-hidden"
    >
      <Link href={`/product/${product.id}`}>
        <div className="aspect-[3/4] overflow-hidden bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 hover:scale-105"
          />
        </div>
        <div className="p-4">
          {product.shop && (
            <p className="mb-1 text-xs uppercase tracking-wide text-faint">{product.shop.name}</p>
          )}
          <h3 className="line-clamp-1 font-medium">{product.name}</h3>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-display text-lg font-bold brand-gradient-text">
              {convertAndFormat(Number(product.price), product.currency, currency)}
            </span>
            <span className="rounded-full bg-surface-2 px-2 py-1 text-[10px] uppercase text-brand-violet">
              {t(`cat.${product.category}`)}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
