import { z } from 'zod';
import { SubscriptionPlan } from '../enums';

export const subscribeSchema = z.object({
  plan: z.nativeEnum(SubscriptionPlan),
  period: z.enum(['monthly', 'annual']).default('monthly'),
  couponCode: z.string().max(32).optional(),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;

export interface SubscriptionStatusDto {
  plan: SubscriptionPlan;
  active: boolean;
  startedAt?: string | null;
  expiresAt?: string | null;
  /** true si la période est dépassée (plan à renouveler). */
  expired: boolean;
}
