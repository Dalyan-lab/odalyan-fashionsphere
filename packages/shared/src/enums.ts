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

// Union de littéraux (pas un `enum` TS) pour rester structurellement compatible
// avec l'enum SubscriptionPlan généré par Prisma côté API (évite les casts).
export const SubscriptionPlan = {
  STARTER: 'STARTER',
  PRO: 'PRO',
  BUSINESS: 'BUSINESS',
  ENTERPRISE: 'ENTERPRISE',
} as const;
export type SubscriptionPlan = (typeof SubscriptionPlan)[keyof typeof SubscriptionPlan];

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

/**
 * Catégories de produits de la place de marché.
 *
 * Les six premières (mode) existent depuis l'origine et ne doivent jamais être
 * renommées : des produits y sont déjà rattachés en base. Les suivantes ouvrent
 * la plateforme aux autres rayons — maison, beauté, high-tech, enfants, loisirs.
 *
 * Le rayon d'appartenance n'est pas stocké : il se déduit de la catégorie via
 * `CATEGORY_DEPARTMENT`, ce qui évite deux champs à maintenir cohérents.
 */
export enum ProductCategory {
  // — Mode
  HOMME = 'HOMME',
  FEMME = 'FEMME',
  ENFANT = 'ENFANT',
  LUXE = 'LUXE',
  SPORT = 'SPORT',
  ACCESSOIRES = 'ACCESSOIRES',
  // — Maison
  CUISINE = 'CUISINE',
  DECORATION = 'DECORATION',
  MEUBLES = 'MEUBLES',
  LINGE_MAISON = 'LINGE_MAISON',
  JARDIN_BRICOLAGE = 'JARDIN_BRICOLAGE',
  // — Beauté & bien-être
  SOINS_BEAUTE = 'SOINS_BEAUTE',
  PARFUMS = 'PARFUMS',
  MAQUILLAGE = 'MAQUILLAGE',
  CHEVEUX = 'CHEVEUX',
  // — High-tech
  TELEPHONIE = 'TELEPHONIE',
  INFORMATIQUE = 'INFORMATIQUE',
  AUDIO_IMAGE = 'AUDIO_IMAGE',
  ELECTROMENAGER = 'ELECTROMENAGER',
  // — Enfants
  JOUETS = 'JOUETS',
  PUERICULTURE = 'PUERICULTURE',
  SCOLAIRE = 'SCOLAIRE',
  // — Loisirs
  SPORT_LOISIRS = 'SPORT_LOISIRS',
  LIVRES_MEDIAS = 'LIVRES_MEDIAS',
  ANIMAUX = 'ANIMAUX',
  AUTO_MOTO = 'AUTO_MOTO',
  // — Divers
  ALIMENTATION = 'ALIMENTATION',
  SANTE = 'SANTE',
  AUTRE = 'AUTRE',
}

/** Rayons de la place de marché : le premier niveau de navigation. */
export enum ProductDepartment {
  MODE = 'MODE',
  MAISON = 'MAISON',
  BEAUTE = 'BEAUTE',
  HIGH_TECH = 'HIGH_TECH',
  ENFANTS = 'ENFANTS',
  LOISIRS = 'LOISIRS',
  DIVERS = 'DIVERS',
}

/** Rayon auquel appartient chaque catégorie. */
export const CATEGORY_DEPARTMENT: Record<ProductCategory, ProductDepartment> = {
  [ProductCategory.HOMME]: ProductDepartment.MODE,
  [ProductCategory.FEMME]: ProductDepartment.MODE,
  [ProductCategory.ENFANT]: ProductDepartment.MODE,
  [ProductCategory.LUXE]: ProductDepartment.MODE,
  [ProductCategory.SPORT]: ProductDepartment.MODE,
  [ProductCategory.ACCESSOIRES]: ProductDepartment.MODE,

  [ProductCategory.CUISINE]: ProductDepartment.MAISON,
  [ProductCategory.DECORATION]: ProductDepartment.MAISON,
  [ProductCategory.MEUBLES]: ProductDepartment.MAISON,
  [ProductCategory.LINGE_MAISON]: ProductDepartment.MAISON,
  [ProductCategory.JARDIN_BRICOLAGE]: ProductDepartment.MAISON,

  [ProductCategory.SOINS_BEAUTE]: ProductDepartment.BEAUTE,
  [ProductCategory.PARFUMS]: ProductDepartment.BEAUTE,
  [ProductCategory.MAQUILLAGE]: ProductDepartment.BEAUTE,
  [ProductCategory.CHEVEUX]: ProductDepartment.BEAUTE,

  [ProductCategory.TELEPHONIE]: ProductDepartment.HIGH_TECH,
  [ProductCategory.INFORMATIQUE]: ProductDepartment.HIGH_TECH,
  [ProductCategory.AUDIO_IMAGE]: ProductDepartment.HIGH_TECH,
  [ProductCategory.ELECTROMENAGER]: ProductDepartment.HIGH_TECH,

  [ProductCategory.JOUETS]: ProductDepartment.ENFANTS,
  [ProductCategory.PUERICULTURE]: ProductDepartment.ENFANTS,
  [ProductCategory.SCOLAIRE]: ProductDepartment.ENFANTS,

  [ProductCategory.SPORT_LOISIRS]: ProductDepartment.LOISIRS,
  [ProductCategory.LIVRES_MEDIAS]: ProductDepartment.LOISIRS,
  [ProductCategory.ANIMAUX]: ProductDepartment.LOISIRS,
  [ProductCategory.AUTO_MOTO]: ProductDepartment.LOISIRS,

  [ProductCategory.ALIMENTATION]: ProductDepartment.DIVERS,
  [ProductCategory.SANTE]: ProductDepartment.DIVERS,
  [ProductCategory.AUTRE]: ProductDepartment.DIVERS,
};

/** Libellés affichés pour les rayons, dans l'ordre de la vitrine. */
export const DEPARTMENT_LABELS: Record<ProductDepartment, string> = {
  [ProductDepartment.MODE]: 'Mode',
  [ProductDepartment.MAISON]: 'Maison',
  [ProductDepartment.BEAUTE]: 'Beauté & bien-être',
  [ProductDepartment.HIGH_TECH]: 'High-tech',
  [ProductDepartment.ENFANTS]: 'Enfants',
  [ProductDepartment.LOISIRS]: 'Loisirs',
  [ProductDepartment.DIVERS]: 'Divers',
};

/** Libellés affichés pour les catégories. */
export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  [ProductCategory.HOMME]: 'Homme',
  [ProductCategory.FEMME]: 'Femme',
  [ProductCategory.ENFANT]: 'Enfant',
  [ProductCategory.LUXE]: 'Luxe',
  [ProductCategory.SPORT]: 'Sportswear',
  [ProductCategory.ACCESSOIRES]: 'Accessoires',

  [ProductCategory.CUISINE]: 'Cuisine',
  [ProductCategory.DECORATION]: 'Décoration',
  [ProductCategory.MEUBLES]: 'Meubles',
  [ProductCategory.LINGE_MAISON]: 'Linge de maison',
  [ProductCategory.JARDIN_BRICOLAGE]: 'Jardin & bricolage',

  [ProductCategory.SOINS_BEAUTE]: 'Soins & beauté',
  [ProductCategory.PARFUMS]: 'Parfums',
  [ProductCategory.MAQUILLAGE]: 'Maquillage',
  [ProductCategory.CHEVEUX]: 'Cheveux',

  [ProductCategory.TELEPHONIE]: 'Téléphonie',
  [ProductCategory.INFORMATIQUE]: 'Informatique',
  [ProductCategory.AUDIO_IMAGE]: 'Audio & image',
  [ProductCategory.ELECTROMENAGER]: 'Électroménager',

  [ProductCategory.JOUETS]: 'Jouets',
  [ProductCategory.PUERICULTURE]: 'Puériculture',
  [ProductCategory.SCOLAIRE]: 'Fournitures scolaires',

  [ProductCategory.SPORT_LOISIRS]: 'Sport & loisirs',
  [ProductCategory.LIVRES_MEDIAS]: 'Livres & médias',
  [ProductCategory.ANIMAUX]: 'Animaux',
  [ProductCategory.AUTO_MOTO]: 'Auto & moto',

  [ProductCategory.ALIMENTATION]: 'Alimentation',
  [ProductCategory.SANTE]: 'Santé',
  [ProductCategory.AUTRE]: 'Autre',
};

/** Catégories d'un rayon, dans l'ordre de déclaration. */
export function categoriesOfDepartment(department: ProductDepartment): ProductCategory[] {
  return (Object.keys(CATEGORY_DEPARTMENT) as ProductCategory[]).filter(
    (c) => CATEGORY_DEPARTMENT[c] === department,
  );
}

/**
 * Vrai pour les catégories de mode : ce sont les seules où l'essayage virtuel,
 * le défilé et les mannequins ont un sens (on n'essaie pas une casserole).
 */
export function isFashionCategory(category: ProductCategory): boolean {
  return CATEGORY_DEPARTMENT[category] === ProductDepartment.MODE;
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

/**
 * Prix mensuel des plans, dans la devise de la plateforme (FCFA).
 *
 * Montants ronds plutôt que convertis au centime : « 10 000 F » se lit comme
 * un prix, « 9 839 F » comme une traduction. Paiement ponctuel par période —
 * le Mobile Money ne gère pas le prélèvement récurrent. Annuel = 10 mois.
 */
export const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.STARTER]: 0,
  [SubscriptionPlan.PRO]: 10_000,
  [SubscriptionPlan.BUSINESS]: 32_000,
  [SubscriptionPlan.ENTERPRISE]: 130_000,
};

export type BillingPeriod = 'monthly' | 'annual';

/** Prix d'un plan pour une période donnée (annuel = ×10). */
export function planPrice(plan: SubscriptionPlan, period: BillingPeriod): number {
  const monthly = PLAN_PRICES[plan];
  return period === 'annual' ? monthly * 10 : monthly;
}

/** Durée d'une période en jours. */
export const PERIOD_DAYS: Record<BillingPeriod, number> = { monthly: 30, annual: 365 };

/** Coût en crédits d'une génération, par type de contenu. */
export const AI_CREDIT_COSTS = {
  image: 1, // mannequin IA, avatar
  tryon: 4, // essayage / défilé — 5 vues générées, une par angle
  campaign: 3, // visuel + textes multi-réseaux
  video: 10, // vidéo IA (le plus coûteux)
  text: 0, // textes publicitaires seuls : gratuits
  viralScript: 2, // script viral ViralAmazone (Hook/Problème/Solution/CTA)
} as const;

export type AiCreditKind = keyof typeof AI_CREDIT_COSTS;

/**
 * Packs de recharge de crédits IA (achat ponctuel via Paystack).
 * Prix dans la devise de la plateforme (FCFA). Modifiable librement.
 * Les crédits achetés sont reportés d'un mois sur l'autre (jamais réinitialisés).
 */
export interface CreditPack {
  id: string;
  credits: number;
  price: number;
  label: string;
  popular?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: 'pack-50', credits: 50, price: 3_000, label: 'Recharge Découverte' },
  { id: 'pack-150', credits: 150, price: 8_000, label: 'Recharge Créateur', popular: true },
  { id: 'pack-500', credits: 500, price: 23_000, label: 'Recharge Studio' },
  { id: 'pack-1500', credits: 1500, price: 60_000, label: 'Recharge Agence' },
];

export function getCreditPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}

/**
 * Devise de référence de la plateforme.
 *
 * Tous les montants sont stockés et saisis dans cette devise. Les autres ne
 * servent qu'à l'affichage, converties à la volée. Faire saisir des euros à un
 * vendeur qui pense en francs a déjà produit une erreur de facteur 656.
 */
export const PLATFORM_CURRENCY = 'XOF';
