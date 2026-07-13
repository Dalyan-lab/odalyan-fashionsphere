/**
 * Enums partagés entre le frontend (Next.js) et le backend (NestJS/Prisma).
 * Doivent rester alignés avec les enums du schéma Prisma.
 */

export enum UserRole {
  ADMIN = 'ADMIN',
  SELLER = 'SELLER',
  CUSTOMER = 'CUSTOMER',
  MARKETING_AGENCY = 'MARKETING_AGENCY',
}

export enum SubscriptionPlan {
  STARTER = 'STARTER',
  PRO = 'PRO',
  BUSINESS = 'BUSINESS',
  ENTERPRISE = 'ENTERPRISE',
}

export enum ProductStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  ARCHIVED = 'ARCHIVED',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentProvider {
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL',
  MOBILE_MONEY = 'MOBILE_MONEY',
  FLUTTERWAVE = 'FLUTTERWAVE',
  CINETPAY = 'CINETPAY',
  PAYSTACK = 'PAYSTACK',
}

export enum ProductCategory {
  HOMME = 'HOMME',
  FEMME = 'FEMME',
  ENFANT = 'ENFANT',
  LUXE = 'LUXE',
  SPORT = 'SPORT',
  ACCESSOIRES = 'ACCESSOIRES',
}

/** Limites produits par plan d'abonnement (cf. cahier des charges). */
export const PLAN_PRODUCT_LIMITS: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.STARTER]: 50,
  [SubscriptionPlan.PRO]: Infinity,
  [SubscriptionPlan.BUSINESS]: Infinity,
  [SubscriptionPlan.ENTERPRISE]: Infinity,
};

/** Quota de stockage d'images/fichiers par plan, en octets (levier de revenus). */
export const PLAN_STORAGE_LIMITS: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.STARTER]: 200 * 1024 * 1024, // 200 Mo
  [SubscriptionPlan.PRO]: 5 * 1024 * 1024 * 1024, // 5 Go
  [SubscriptionPlan.BUSINESS]: 50 * 1024 * 1024 * 1024, // 50 Go
  [SubscriptionPlan.ENTERPRISE]: Infinity,
};

/** Crédits IA offerts chaque mois selon le plan (générations d'images/vidéos). */
export const PLAN_AI_CREDITS: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.STARTER]: 15,
  [SubscriptionPlan.PRO]: 150,
  [SubscriptionPlan.BUSINESS]: 600,
  [SubscriptionPlan.ENTERPRISE]: 5000,
};

/** Coût en crédits d'une génération, par type de contenu. */
export const AI_CREDIT_COSTS = {
  image: 1, // mannequin IA, avatar
  tryon: 3, // essayage / défilé (plusieurs vues)
  campaign: 3, // visuel + textes multi-réseaux
  video: 10, // vidéo IA (le plus coûteux)
  text: 0, // textes publicitaires seuls : gratuits
} as const;

export type AiCreditKind = keyof typeof AI_CREDIT_COSTS;
