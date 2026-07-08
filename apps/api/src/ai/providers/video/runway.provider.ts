import { Injectable, Logger } from '@nestjs/common';
import type { VideoProviderOption } from '@odalyan/shared';
import type {
  VideoCreateInput,
  VideoCreateResult,
  VideoGenProvider,
  VideoStatusResult,
} from './video-provider.interface';

const RUNWAY_VERSION = '2024-11-06';

/** Image→vidéo (Runway). Idéal pour animer un mannequin/produit (défilé, mouvement). */
@Injectable()
export class RunwayProvider implements VideoGenProvider {
  private readonly logger = new Logger(RunwayProvider.name);
  readonly id = 'runway';
  readonly label = 'Runway — Image animée en vidéo';
  readonly description = 'Anime une image (mannequin/produit) en vidéo : défilé, mouvement, scène.';
  readonly kind = 'video' as const;
  readonly needs = ['image', 'prompt'] as const as ('product' | 'image' | 'script' | 'prompt')[];

  get enabled(): boolean {
    return Boolean(process.env.RUNWAYML_API_SECRET);
  }

  options(): VideoProviderOption[] {
    return [
      {
        key: 'model',
        label: 'Modèle',
        default: 'gen4_turbo',
        values: [
          { value: 'gen4_turbo', label: 'Gen-4 Turbo (qualité)' },
          { value: 'gen3a_turbo', label: 'Gen-3 Alpha Turbo (rapide)' },
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
        default: '1280:720',
        values: [
          { value: '1280:720', label: 'Paysage 16:9' },
          { value: '720:1280', label: 'Vertical 9:16' },
          { value: '960:960', label: 'Carré 1:1' },
        ],
      },
    ];
  }

  async create(input: VideoCreateInput): Promise<VideoCreateResult> {
    if (!input.imageUrl) return { providerRef: null, status: 'FAILED' };
    try {
      const res = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RUNWAYML_API_SECRET}`,
          'X-Runway-Version': RUNWAY_VERSION,
        },
        body: JSON.stringify({
          model: input.model ?? 'gen4_turbo',
          promptImage: input.imageUrl,
          promptText: input.prompt ?? 'fashion model walking on a runway, cinematic, smooth motion',
          ratio: input.ratio ?? '1280:720',
          duration: input.duration ?? 5,
        }),
      });
      if (!res.ok) {
        this.logger.error(`Runway create ${res.status}: ${await res.text().catch(() => '')}`);
        return { providerRef: null, status: 'FAILED' };
      }
      const data = (await res.json()) as { id?: string };
      return data.id ? { providerRef: data.id, status: 'PENDING' } : { providerRef: null, status: 'FAILED' };
    } catch (err) {
      this.logger.error(`Runway erreur: ${String(err)}`);
      return { providerRef: null, status: 'FAILED' };
    }
  }

  async status(providerRef: string): Promise<VideoStatusResult> {
    try {
      const res = await fetch(`https://api.dev.runwayml.com/v1/tasks/${providerRef}`, {
        headers: {
          Authorization: `Bearer ${process.env.RUNWAYML_API_SECRET}`,
          'X-Runway-Version': RUNWAY_VERSION,
        },
      });
      if (!res.ok) return { status: 'PENDING' };
      const data = (await res.json()) as { status?: string; output?: string[] };
      if (data.status === 'SUCCEEDED') return { status: 'READY', url: data.output?.[0] ?? null };
      if (data.status === 'FAILED' || data.status === 'CANCELLED') return { status: 'FAILED' };
      return { status: 'PENDING' };
    } catch {
      return { status: 'PENDING' };
    }
  }
}
