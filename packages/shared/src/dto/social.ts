import { z } from 'zod';
import { SocialNetwork } from './ai';

export const schedulePostSchema = z.object({
  caption: z.string().min(1, 'Légende requise').max(3000),
  imageUrl: z.string().url().optional(),
  networks: z.array(z.nativeEnum(SocialNetwork)).min(1, 'Choisissez au moins un réseau'),
  scheduledAt: z.string().optional(), // ISO ; absent = maintenant
  campaignAssetId: z.string().optional(),
});

export type SchedulePostInput = z.infer<typeof schedulePostSchema>;

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
  networks: string[];
  scheduledAt: string;
  status: string; // SCHEDULED | PUBLISHED | PARTIAL | FAILED | CANCELLED
  publishedAt?: string | null;
  createdAt: string;
  /** Détail par réseau (clé = nom du réseau). */
  results?: Record<string, PublishOutcome> | null;
  lastError?: string | null;
}
