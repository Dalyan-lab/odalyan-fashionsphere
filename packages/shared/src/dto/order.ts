import { z } from 'zod';

export const checkoutItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().positive(),
});

export const shippingAddressSchema = z.object({
  fullName: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(2),
  phone: z.string().optional(),
});

export const checkoutSchema = z.object({
  items: z.array(checkoutItemSchema).min(1, 'Le panier est vide'),
  shippingAddress: shippingAddressSchema,
});

/** Statuts qu'un vendeur peut appliquer lui-même à une commande. */
export const SELLER_ORDER_STATUSES = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
export type SellerOrderStatus = (typeof SELLER_ORDER_STATUSES)[number];

/**
 * Changement de statut par le vendeur, avec les informations de suivi.
 *
 * Les champs de suivi accompagnent le passage à « expédiée ». Ils tolèrent la
 * chaîne vide pour permettre de corriger une saisie erronée : sans cela, un
 * numéro de suivi faux resterait affiché au client pour toujours.
 */
export const updateOrderStatusSchema = z.object({
  status: z.enum(SELLER_ORDER_STATUSES),
  carrier: z.string().max(60).optional(),
  trackingNumber: z.string().max(120).optional(),
  trackingUrl: z.string().url().or(z.literal('')).optional(),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

export type CheckoutItemInput = z.infer<typeof checkoutItemSchema>;
export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
