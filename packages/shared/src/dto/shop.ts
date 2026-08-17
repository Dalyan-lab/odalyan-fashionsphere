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

/**
 * Réglages de livraison d'une boutique.
 *
 * `null` remet un montant à vide, ce qui signifie « livraison offerte » — un
 * vendeur doit pouvoir revenir en arrière, pas seulement changer de tarif.
 * Les zones sont envoyées en bloc et remplacent les précédentes : gérer des
 * créations, modifications et suppressions séparées pour trois lignes de
 * tarifs coûterait plus cher que de tout réécrire.
 */
export const shippingRateSchema = z.object({
  name: z.string().min(1, 'Nom de la zone requis').max(60),
  // Listes vides = « toutes les villes » / « tous les pays ».
  cities: z.array(z.string().max(80)).max(50).default([]),
  countries: z.array(z.string().max(80)).max(50).default([]),
  fee: z.number().min(0).max(10_000_000),
});

export const shippingSettingsSchema = z.object({
  shippingFee: z.number().min(0).max(10_000_000).nullable().optional(),
  freeShippingFrom: z.number().min(0).max(10_000_000).nullable().optional(),
  rates: z.array(shippingRateSchema).max(20).optional(),
});

export type ShippingRateInput = z.infer<typeof shippingRateSchema>;
export type ShippingSettingsInput = z.infer<typeof shippingSettingsSchema>;

export type CreateShopInput = z.infer<typeof createShopSchema>;
export type UpdateShopInput = z.infer<typeof updateShopSchema>;
