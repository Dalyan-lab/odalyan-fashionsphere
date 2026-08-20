import { z } from 'zod';
import { SocialNetwork } from './ai';

export const schedulePostSchema = z.object({
  caption: z.string().min(1, 'Légende requise').max(3000),
  imageUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(), // vidéo à publier (TikTok, Reels…)
  networks: z.array(z.nativeEnum(SocialNetwork)).min(1, 'Choisissez au moins un réseau'),
  scheduledAt: z.string().optional(), // ISO ; absent = maintenant
  campaignAssetId: z.string().optional(),
});

export type SchedulePostInput = z.infer<typeof schedulePostSchema>;

/**
 * Édition d'une publication non encore publiée (ou relance d'une publication
 * échouée/annulée) : tout champ absent reste inchangé ; media null = retiré.
 */
export const updateScheduledPostSchema = z.object({
  caption: z.string().min(1, 'Légende requise').max(3000).optional(),
  scheduledAt: z.string().optional(), // ISO ; absent = inchangé
  networks: z.array(z.nativeEnum(SocialNetwork)).min(1).optional(),
  imageUrl: z.string().url().nullable().optional(),
  videoUrl: z.string().url().nullable().optional(),
});

export type UpdateScheduledPostInput = z.infer<typeof updateScheduledPostSchema>;

// ── Pilotage social : génération de textes adaptés par réseau ──────────────

export const generateSocialCopySchema = z.object({
  brief: z.string().min(3, 'Décrivez le sujet de la publication').max(600),
  tone: z.string().max(120).optional(),
  postType: z.string().max(40).optional(), // promo | actu | temoignage | coulisses | autre
  networks: z.array(z.nativeEnum(SocialNetwork)).min(1, 'Choisissez au moins un réseau'),
});

export type GenerateSocialCopyInput = z.infer<typeof generateSocialCopySchema>;

/** Un texte prêt à publier par réseau (clé = SocialNetwork). */
export interface SocialCopyResult {
  texts: Record<string, string>;
  provider: 'anthropic' | 'mock';
}

export const generateSocialIdeasSchema = z.object({
  tone: z.string().max(120).optional(),
});

export type GenerateSocialIdeasInput = z.infer<typeof generateSocialIdeasSchema>;

/** Idées de sujets + hashtags pertinents pour la boutique. */
export interface SocialIdeasResult {
  ideas: string[];
  hashtags: string[];
  provider: 'anthropic' | 'mock';
}

export interface SocialConnectionInfo {
  network: string;
  connected: boolean;
  accountName?: string | null;
  /**
   * Échéance du jeton, quand le réseau en impose une.
   *
   * Remontée jusqu'à l'interface parce qu'une connexion qui expire sans
   * prévenir fait échouer une publication programmée en pleine nuit : le
   * vendeur ne l'apprend qu'après coup, sur un message d'erreur.
   */
  expiresAt?: string | null;
  /** Jours restants, arrondis. Négatif si le jeton est déjà expiré. */
  expiresInDays?: number | null;
}

/**
 * Seuil d'alerte : en deçà, l'interface invite à reconnecter le compte.
 *
 * Une semaine laisse le temps d'agir sans transformer l'avertissement en
 * bruit permanent — un bandeau affiché soixante jours d'affilée cesse d'être lu.
 */
export const SOCIAL_TOKEN_WARN_DAYS = 7;

/** État d'un réseau : provider écrit ? app développeur configurée ? */
export interface SocialNetworkStatus {
  network: string;
  label: string;
  supported: boolean;
  enabled: boolean;
  requirement: string;
}

/** Résultat de publication pour un réseau donné. */
export interface PublishOutcome {
  ok: boolean;
  externalId?: string;
  error?: string;
  /** Publication simulée (app développeur non configurée ou compte de démo). */
  simulated?: boolean;
}

// ── Analyse : créneaux, meilleures publications, rapport mensuel ───────────

/** Créneau de publication observé, avec sa performance moyenne constatée. */
export interface BestTimeSlot {
  network: string;
  /** Jour ISO : 1 = lundi … 7 = dimanche. */
  weekday: number;
  hour: number;
  /** Interactions moyennes (j'aime + commentaires + partages) par publication. */
  avgInteractions: number;
  /** Nombre de publications observées sur ce créneau — indique la fiabilité. */
  samples: number;
}

export interface BestTimesResult {
  /** Créneaux calculés sur les publications réelles ; vide tant qu'il n'y a pas assez de recul. */
  slots: BestTimeSlot[];
  /** Publications mesurées ayant servi au calcul. */
  analyzed: number;
  /** Publications mesurées nécessaires avant de proposer un calcul. */
  minimum: number;
}

/** Publication classée par performance, pour le recyclage et le rapport. */
export interface TopPostDto {
  id: string;
  caption: string;
  networks: string[];
  publishedAt?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  views: number;
  /** j'aime + commentaires + partages, cumulés sur tous les réseaux. */
  interactions: number;
}

export interface MonthlyReportDto {
  month: string; // AAAA-MM
  published: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  byNetwork: { network: string; published: number; views: number; interactions: number }[];
  topPosts: TopPostDto[];
  /** Évolution des interactions vs mois précédent, en % ; null si aucun point de comparaison. */
  interactionsChange: number | null;
}

/** Statistiques d'une publication sur un réseau, telles que remontées par son API. */
export interface PostInsightDto {
  network: string;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  fetchedAt: string;
  /** Renseigné quand le réseau n'a rien pu remonter (permission manquante, contenu supprimé…). */
  error?: string | null;
}

export interface ScheduledPostDto {
  id: string;
  caption: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  networks: string[];
  scheduledAt: string;
  status: string; // SCHEDULED | PUBLISHED | PARTIAL | FAILED | CANCELLED
  publishedAt?: string | null;
  createdAt: string;
  /** Détail par réseau (clé = nom du réseau). */
  results?: Record<string, PublishOutcome> | null;
  lastError?: string | null;
  /** Statistiques par réseau, rafraîchies périodiquement (vide tant qu'aucune lecture). */
  insights?: PostInsightDto[];
}
