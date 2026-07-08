'use client';

import { loadStripe, type Stripe } from '@stripe/stripe-js';

const KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

/** Promesse Stripe partagée (null si la clé publishable n'est pas configurée). */
export const stripePromise: Promise<Stripe | null> | null = KEY ? loadStripe(KEY) : null;

export const stripeConfigured = Boolean(KEY);
