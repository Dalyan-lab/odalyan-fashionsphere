import { z } from 'zod';
import { ProductCategory, ProductStatus } from '../enums';

export const variantSchema = z.object({
  size: z.string().min(1).max(20),
  color: z.string().min(1).max(40),
  sku: z.string().max(60).optional(),
  stock: z.number().int().min(0).default(0),
  priceOverride: z.number().positive().optional(),
});

export const createProductSchema = z.object({
  name: z.string().min(2, 'Nom du produit requis').max(140),
  description: z.string().max(5000).optional(),
  category: z.nativeEnum(ProductCategory),
  price: z.number().positive('Le prix doit être positif'),
  currency: z.string().length(3).default('EUR'),
  status: z.nativeEnum(ProductStatus).default(ProductStatus.DRAFT),
  images: z.array(z.string().url()).default([]),
  videos: z.array(z.string().url()).default([]),
  variants: z.array(variantSchema).default([]),
  affiliateUrl: z.string().url().optional(),
  sourceMarketplace: z.string().max(40).optional(),
});

export const updateProductSchema = createProductSchema.partial();

export type VariantInput = z.infer<typeof variantSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
