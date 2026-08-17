import { z } from 'zod';

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, 'Couleur hexadécimale invalide (ex: #C9A227)');

const shopFields = z.object({
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
  // Délai de livraison annoncé, en jours ouvrés. `null` remet le champ à vide :
  // sans cette tolérance, un délai saisi par erreur ne pourrait plus être retiré.
  deliveryDaysMin: z.number().int().min(0).max(365).nullable().optional(),
  deliveryDaysMax: z.number().int().min(0).max(365).nullable().optional(),
  deliveryNote: z.string().max(300).optional(),
});

/**
 * Un délai « de 7 à 2 jours » n'a pas de sens et serait affiché tel quel au
 * client. On refuse la saisie plutôt que de la corriger en silence.
 */
const coherentDeliveryRange = (
  v: { deliveryDaysMin?: number | null; deliveryDaysMax?: number | null },
  ctx: z.RefinementCtx,
) => {
  if (
    typeof v.deliveryDaysMin === 'number' &&
    typeof v.deliveryDaysMax === 'number' &&
    v.deliveryDaysMin > v.deliveryDaysMax
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['deliveryDaysMax'],
      message: 'Le délai maximum doit être supérieur ou égal au minimum.',
    });
  }
};

export const createShopSchema = shopFields.superRefine(coherentDeliveryRange);
export const updateShopSchema = shopFields.partial().superRefine(coherentDeliveryRange);

export type CreateShopInput = z.infer<typeof createShopSchema>;
export type UpdateShopInput = z.infer<typeof updateShopSchema>;
