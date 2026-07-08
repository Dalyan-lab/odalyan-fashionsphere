import { Injectable, Logger } from '@nestjs/common';
import type { VideoProviderOption } from '@odalyan/shared';
import type {
  VideoCreateInput,
  VideoCreateResult,
  VideoGenProvider,
  VideoStatusResult,
} from './video-provider.interface';

/**
 * Kling AI — image→vidéo (Kuaishou). Bon rendu de mouvement (défilé, marche).
 * NB : l'authentification Kling se fait par jeton (Bearer). Selon ton offre,
 * KLING_API_KEY peut être un jeton direct ou un JWT généré depuis access/secret key.
 */
@Injectable()
export class KlingProvider implements VideoGenProvider {
  private readonly logger = new Logger(KlingProvider.name);
  readonly id = 'kling';
  readonly label = 'Kling — Image animée (cinématique)';
  readonly description = 'Anime une image en vidéo cinématique fluide (marche, défilé, mouvement).';
  readonly kind = 'video' as const;
  readonly needs = ['image', 'prompt'] as const as ('product' | 'image' | 'script' | 'prompt')[];

  get enabled(): boolean {
    return Boolean(process.env.KLING_API_KEY);
  }

  options(): VideoProviderOption[] {
    return [
      {
        key: 'model',
        label: 'Mode',
        default: 'std',
        values: [
          { value: 'std', label: 'Standard (rapide)' },
          { value: 'pro', label: 'Pro (qualité)' },
        ],
      },
      {
        key: 'duration',
        label: 'Durée',
        default: '5',
        values: [
          { value: '5', label: '5 secondes' },
          { value: '10', label: '10 secondes' },
        ],
      },
      {
        key: 'ratio',
        label: 'Format',
        default: '16:9',
        values: [
          { value: '16:9', label: 'Paysage 16:9' },
          { value: '9:16', label: 'Vertical 9:16' },
          { value: '1:1', label: 'Carré 1:1' },
        ],
      },
    ];
  }

  async create(input: VideoCreateInput): Promise<VideoCreateResult> {
    if (!input.imageUrl) return { providerRef: null, status: 'FAILED' };
    try {
      const res = await fetch('https://api.klingai.com/v1/videos/image2video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.KLING_API_KEY}`,
        },
        body: JSON.stringify({
          model_name: 'kling-v1',
          mode: input.model ?? 'std',
          image: input.imageUrl,
          prompt: input.prompt ?? 'fashion model walking, cinematic, smooth motion',
          duration: String(input.duration ?? 5),
          aspect_ratio: input.ratio ?? '16:9',
        }),
      });
      if (!res.ok) {
        this.logger.error(`Kling create ${res.status}: ${await res.text().catch(() => '')}`);
        return { providerRef: null, status: 'FAILED' };
      }
      const data = (await res.json()) as { data?: { task_id?: string } };
      const id = data.data?.task_id;
      return id ? { providerRef: id, status: 'PENDING' } : { providerRef: null, status: 'FAILED' };
    } catch (err) {
      this.logger.error(`Kling erreur: ${String(err)}`);
      return { providerRef: null, status: 'FAILED' };
    }
  }

  async status(providerRef: string): Promise<VideoStatusResult> {
    try {
      const res = await fetch(`https://api.klingai.com/v1/videos/image2video/${providerRef}`, {
        headers: { Authorization: `Bearer ${process.env.KLING_API_KEY}` },
      });
      if (!res.ok) return { status: 'PENDING' };
      const data = (await res.json()) as {
        data?: { task_status?: string; task_result?: { videos?: { url?: string }[] } };
      };
      const s = data.data?.task_status;
      if (s === 'succeed') return { status: 'READY', url: data.data?.task_result?.videos?.[0]?.url ?? null };
      if (s === 'failed') return { status: 'FAILED' };
      return { status: 'PENDING' };
    } catch {
      return { status: 'PENDING' };
    }
  }
}
