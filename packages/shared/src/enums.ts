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
