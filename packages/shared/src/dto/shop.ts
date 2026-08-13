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
  // '' permet de retirer le média : sans cette tolérance, un champ vidé ne peut
  // plus jamais l'être puisque la validation d'URL rejetterait la chaîne vide.
  logoUrl: z.string().url().or(z.literal('')).optional(),
  bannerUrl: z.string().url().or(z.literal('')).optional(),
  videoUrl: z.string().url().or(z.literal('')).optional(),
  primaryColor: hexColor.optional(),
  secondaryColor: hexColor.optional(),
  showNameOnBanner: z.boolean().optional(),
  showSloganOnBanner: z.boolean().optional(),
  logoPosition: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).optional(),
  // "top" | "center" | "bottom" (héritage) ou pourcentage vertical "0%"…"100%"
  bannerPosition: z.string().max(12).optional(),
});

export const updateShopSchema = createShopSchema.partial();

export type CreateShopInput = z.infer<typeof createShopSchema>;
export type UpdateShopInput = z.infer<typeof updateShopSchema>;
