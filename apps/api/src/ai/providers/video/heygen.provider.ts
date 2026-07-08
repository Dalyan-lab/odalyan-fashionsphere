import { Injectable, Logger } from '@nestjs/common';
import type { VideoProviderOption } from '@odalyan/shared';
import type {
  VideoCreateInput,
  VideoCreateResult,
  VideoGenProvider,
  VideoStatusResult,
} from './video-provider.interface';

/** Avatar présentateur/influenceur qui parle (HeyGen). */
@Injectable()
export class HeyGenProvider implements VideoGenProvider {
  private readonly logger = new Logger(HeyGenProvider.name);
  readonly id = 'heygen';
  readonly label = 'HeyGen — Avatar présentateur';
  readonly description = 'Un avatar réaliste présente le produit face caméra (texte parlé).';
  readonly kind = 'avatar' as const;
  readonly needs = ['script'] as const as ('product' | 'image' | 'script' | 'prompt')[];

  get enabled(): boolean {
    return Boolean(process.env.HEYGEN_API_KEY);
  }

  options(): VideoProviderOption[] {
    return [
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
    const dims: Record<string, { width: number; height: number }> = {
      '16:9': { width: 1280, height: 720 },
      '9:16': { width: 720, height: 1280 },
      '1:1': { width: 1080, height: 1080 },
    };
    const dimension = dims[input.ratio ?? '16:9'] ?? dims['16:9'];

    try {
      const res = await fetch('https://api.heygen.com/v2/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': process.env.HEYGEN_API_KEY! },
        body: JSON.stringify({
          video_inputs: [
            {
              character: {
                type: 'avatar',
                avatar_id: process.env.HEYGEN_AVATAR_ID ?? 'Daisy-inskirt-20220818',
                avatar_style: 'normal',
              },
              voice: {
                type: 'text',
                input_text: input.script ?? '',
                voice_id: process.env.HEYGEN_VOICE_ID ?? '1bd001e7e50f421d891986aad5158bc8',
              },
            },
          ],
          dimension,
        }),
      });
      if (!res.ok) {
        this.logger.error(`HeyGen generate ${res.status}`);
        return { providerRef: null, status: 'FAILED' };
      }
      const data = (await res.json()) as { data?: { video_id?: string } };
      const id = data.data?.video_id;
      return id ? { providerRef: id, status: 'PENDING' } : { providerRef: null, status: 'FAILED' };
    } catch (err) {
      this.logger.error(`HeyGen erreur: ${String(err)}`);
      return { providerRef: null, status: 'FAILED' };
    }
  }

  async status(providerRef: string): Promise<VideoStatusResult> {
    try {
      const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${providerRef}`, {
        headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY! },
      });
      if (!res.ok) return { status: 'PENDING' };
      const data = (await res.json()) as { data?: { status?: string; video_url?: string } };
      const s = data.data?.status;
      if (s === 'completed') return { status: 'READY', url: data.data?.video_url ?? null };
      if (s === 'failed') return { status: 'FAILED' };
      return { status: 'PENDING' };
    } catch {
      return { status: 'PENDING' };
    }
  }
}
