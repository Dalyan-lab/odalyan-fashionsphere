/**
 * Système d'encouragement ViralAmazone — Couche 1 (voir doc de conception).
 * Récompense l'ACTIVITÉ MESURABLE EN TEMPS RÉEL (clics via notre lien traçant,
 * régularité de génération) en crédits IA bonus. Aucun mouvement d'argent réel :
 * le partage de commission Amazon réelle (Couche 2) est un chantier séparé,
 * dépendant des rapports mensuels Associates Central (non automatisable).
 */

// Union de littéraux (pas un `enum` TS) pour rester structurellement compatible avec
// l'enum Prisma généré côté API — évite les soucis de typage nominal entre les deux.
export const CreatorTier = {
  BRONZE: 'BRONZE',
  SILVER: 'SILVER',
  GOLD: 'GOLD',
  PLATINUM: 'PLATINUM',
} as const;
export type CreatorTier = (typeof CreatorTier)[keyof typeof CreatorTier];

export const TIER_ORDER: CreatorTier[] = [
  CreatorTier.BRONZE,
  CreatorTier.SILVER,
  CreatorTier.GOLD,
  CreatorTier.PLATINUM,
];

/** Clics cumulés (via le lien traçant /go/:scriptId) requis pour atteindre chaque niveau. */
export const TIER_THRESHOLDS: Record<CreatorTier, number> = {
  [CreatorTier.BRONZE]: 0,
  [CreatorTier.SILVER]: 50,
  [CreatorTier.GOLD]: 250,
  [CreatorTier.PLATINUM]: 1000,
};

/** Coût en crédits d'une génération de script viral, réduit selon le niveau atteint. */
export const TIER_SCRIPT_COST: Record<CreatorTier, number> = {
  [CreatorTier.BRONZE]: 2,
  [CreatorTier.SILVER]: 2,
  [CreatorTier.GOLD]: 1,
  [CreatorTier.PLATINUM]: 1,
};

/** Bonus de crédits accordé une seule fois au passage à un niveau supérieur. */
export const TIER_UP_BONUS: Record<CreatorTier, number> = {
  [CreatorTier.BRONZE]: 0,
  [CreatorTier.SILVER]: 10,
  [CreatorTier.GOLD]: 25,
  [CreatorTier.PLATINUM]: 75,
};

/** Jalons de clics cumulés, chacun accordé une seule fois (à vie). */
export const CLICK_MILESTONES: { clicks: number; credits: number }[] = [
  { clicks: 10, credits: 3 },
  { clicks: 50, credits: 10 },
  { clicks: 100, credits: 15 },
  { clicks: 500, credits: 40 },
  { clicks: 1000, credits: 75 },
  { clicks: 5000, credits: 200 },
];

/** Jalons de série (jours consécutifs avec au moins une génération), accordés une seule fois. */
export const STREAK_MILESTONES: { days: number; credits: number }[] = [
  { days: 3, credits: 5 },
  { days: 7, credits: 15 },
  { days: 30, credits: 60 },
];

/** Bonus du classement hebdomadaire (clics de la semaine), rangs 1/2/3. */
export const LEADERBOARD_BONUS: number[] = [30, 20, 10];

/** Niveau atteint pour un nombre de clics cumulés donné. */
export function tierForClicks(totalClicks: number): CreatorTier {
  let tier: CreatorTier = CreatorTier.BRONZE;
  for (const t of TIER_ORDER) {
    if (totalClicks >= TIER_THRESHOLDS[t]) tier = t;
  }
  return tier;
}

export interface CreatorProgressDto {
  tier: CreatorTier;
  totalClicks: number;
  currentStreakDays: number;
  longestStreakDays: number;
  nextTier: CreatorTier | null;
  clicksToNextTier: number | null;
  scriptCost: number;
  recentRewards: { kind: string; credits: number; createdAt: string }[];
}

export interface LeaderboardEntryDto {
  shopId: string;
  shopName: string;
  clicks: number;
  isMe: boolean;
}
