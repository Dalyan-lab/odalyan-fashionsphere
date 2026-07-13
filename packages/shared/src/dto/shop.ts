import { z } from 'zod';

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, 'Couleur hexadécimale invalide (ex: #C9A227)');

export const createShopSchema = z.object({
  name: z.string().min(2, 'Nom de la boutique requis').max(80),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Slug invalide (minuscules, chiffres et tirets uniquement)'),
  slogan: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().url().optional(),
  bannerUrl: z.string().url().optional(),
  primaryColor: hexColor.optional(),
  secondaryColor: hexColor.optional(),
  showNameOnBanner: z.boolean().optional(),
  showSloganOnBanner: z.boolean().optional(),
});

export const updateShopSchema = createShopSchema.partial();

export type CreateShopInput = z.infer<typeof createShopSchema>;
export type UpdateShopInput = z.infer<typeof updateShopSchema>;
