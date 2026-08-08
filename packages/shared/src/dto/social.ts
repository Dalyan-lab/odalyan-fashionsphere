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
}

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
}
