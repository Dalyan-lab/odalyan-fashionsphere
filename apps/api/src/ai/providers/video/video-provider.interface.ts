import type { VideoProviderOption } from '@odalyan/shared';

export type VideoStatus = 'PENDING' | 'READY' | 'FAILED';

export interface VideoCreateInput {
  productName?: string;
  imageUrl?: string; // image source pour image→vidéo
  prompt?: string; // description du mouvement / scène
  script?: string; // texte parlé (avatar)
  tone?: string;
  language?: string;
  model?: string;
  ratio?: string;
  duration?: number;
}

export interface VideoCreateResult {
  providerRef: string | null;
  status: VideoStatus;
  url?: string | null;
}

export interface VideoStatusResult {
  status: VideoStatus;
  url?: string | null;
}

/** Contrat commun à tous les fournisseurs de génération vidéo. */
export interface VideoGenProvider {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly kind: 'avatar' | 'video';
  /** Champs requis côté UI : produit, image, script, prompt. */
  readonly needs: ('product' | 'image' | 'script' | 'prompt')[];
  /** Vrai si une clé API est configurée. */
  readonly enabled: boolean;
  /** Options configurables (modèle, durée, ratio…). */
  options(): VideoProviderOption[];
  create(input: VideoCreateInput): Promise<VideoCreateResult>;
  status(providerRef: string): Promise<VideoStatusResult>;
}

export const VIDEO_PROVIDERS = Symbol('VIDEO_PROVIDERS');
