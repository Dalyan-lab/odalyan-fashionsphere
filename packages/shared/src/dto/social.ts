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

export interface ScheduledPostDto {
  id: string;
  caption: string;
  imageUrl?: string | null;
  networks: string[];
  scheduledAt: string;
  status: string; // SCHEDULED | PUBLISHED | FAILED | CANCELLED
  publishedAt?: string | null;
  createdAt: string;
}
