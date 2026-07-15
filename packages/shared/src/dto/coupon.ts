import { z } from 'zod';

export const createCouponSchema = z
  .object({
    code: z.string().min(3).max(32).regex(/^[A-Za-z0-9_-]+$/, 'Lettres, chiffres, - et _ uniquement'),
    description: z.string().max(200).optional(),
    percentOff: z.coerce.number().int().min(1).max(100).optional(),
    amountOffEur: z.coerce.number().positive().optional(),
    appliesTo: z.enum(['credits', 'order', 'all']).default('credits'),
    maxRedemptions: z.coerce.number().int().min(1).optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .refine((v) => v.percentOff != null || v.amountOffEur != null, {
    message: 'Indiquez une remise en % ou un montant fixe.',
  });

export type CreateCouponInput = z.infer<typeof createCouponSchema>;

export const validateCouponSchema = z.object({
  code: z.string().min(1).max(32),
  packId: z.string().min(1),
});

export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;

export interface CouponPreview {
  code: string;
  valid: boolean;
  reason?: string; // si invalide
  originalEur?: number;
  discountEur?: number;
  finalEur?: number;
  label?: string; // ex: "-40%"
}

export interface CouponDto {
  id: string;
  code: string;
  description?: string | null;
  percentOff?: number | null;
  amountOffEur?: number | null;
  appliesTo: string;
  maxRedemptions?: number | null;
  timesRedeemed: number;
  active: boolean;
  expiresAt?: string | null;
  createdAt: string;
}
