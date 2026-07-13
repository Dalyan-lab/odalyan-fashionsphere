import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { VideoProviderOption } from '@odalyan/shared';
import { StorageService } from '../../../storage/storage.service';
import type {
  VideoCreateInput,
  VideoCreateResult,
  VideoGenProvider,
  VideoStatusResult,
} from './video-provider.interface';

/** Modèle vidéo Replicate (image→vidéo), surchargeable par variable d'env. */
const REPLICATE_VIDEO_MODEL = () => process.env.REPLICATE_VIDEO_MODEL || 'kwaivgi/kling-v1.6-standard';

/**
 * Image→vidéo via Replicate (Kling par défaut). Anime un mannequin/produit :
 * défilé, rotation 360°, mouvement. Une seule clé Replicate couvre image + vidéo.
 */
@Injectable()
export class ReplicateVideoProvider implements VideoGenProvider {
  private readonly logger = new Logger(ReplicateVideoProvider.name);
  readonly id = 'replicate';
  readonly label = 'Replicate — Image animée en vidéo';
  readonly description = 'Anime une image (mannequin/produit) en vidéo : défilé, rotation, mouvement fluide.';
  readonly kind = 'video' as const;
  readonly needs = ['image', 'prompt'] as const as ('product' | 'image' | 'script' | 'prompt')[];

  constructor(private readonly storage: StorageService) {}

  get enabled(): boolean {
    return Boolean(process.env.REPLICATE_API_TOKEN);
  }

  options(): VideoProviderOption[] {
    return [
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
        default: '9:16',
        values: [
          { value: '9:16', label: 'Vertical 9:16 (réseaux)' },
          { value: '16:9', label: 'Paysage 16:9' },
          { value: '1:1', label: 'Carré 1:1' },
        ],
      },
    ];
  }

  async create(input: VideoCreateInput): Promise<VideoCreateResult> {
    if (!input.imageUrl) return { providerRef: null, status: 'FAILED' };
    try {
      const res = await fetch(
        `https://api.replicate.com/v1/models/${REPLICATE_VIDEO_MODEL()}/predictions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: {
              prompt:
                input.prompt ?? 'fashion model walking on a runway, 360 turn, smooth cinematic motion',
              start_image: input.imageUrl,
              duration: Number(input.duration ?? 5),
              aspect_ratio: input.ratio ?? '9:16',
            },
          }),
        },
      );
      if (!res.ok) {
        this.logger.error(`Replicate vidéo create ${res.status}: ${await res.text().catch(() => '')}`);
        return { providerRef: null, status: 'FAILED' };
      }
      const data = (await res.json()) as { id?: string; status?: string };
      return data.id ? { providerRef: data.id, status: 'PENDING' } : { providerRef: null, status: 'FAILED' };
    } catch (err) {
      this.logger.error(`Replicate vidéo erreur: ${String(err)}`);
      return { providerRef: null, status: 'FAILED' };
    }
  }

  async status(providerRef: string): Promise<VideoStatusResult> {
    try {
      const res = await fetch(`https://api.replicate.com/v1/predictions/${providerRef}`, {
        headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
      });
      if (!res.ok) return { status: 'PENDING' };
      const data = (await res.json()) as { status?: string; output?: unknown };
      if (data.status === 'succeeded') {
        const out = Array.isArray(data.output) ? data.output[0] : data.output;
        const url = typeof out === 'string' ? await this.persist(out) : null;
        return { status: 'READY', url };
      }
      if (data.status === 'failed' || data.status === 'canceled') return { status: 'FAILED' };
      return { status: 'PENDING' };
    } catch {
      return { status: 'PENDING' };
    }
  }

  /** Copie la vidéo Replicate (URL temporaire) sur R2 pour la rendre permanente. */
  private async persist(url: string): Promise<string> {
    if (!this.storage.enabled) return url;
    try {
      const res = await fetch(url);
      if (!res.ok) return url;
      const contentType = res.headers.get('content-type') ?? 'video/mp4';
      const buffer = Buffer.from(await res.arrayBuffer());
      return await this.storage.save(buffer, `${randomUUID()}.mp4`, contentType, 'ai');
    } catch (err) {
      this.logger.error(`Persistance R2 de la vidéo échouée: ${String(err)}`);
      return url;
    }
  }
}
