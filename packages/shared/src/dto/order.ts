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

export type CheckoutItemInput = z.infer<typeof checkoutItemSchema>;
export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
