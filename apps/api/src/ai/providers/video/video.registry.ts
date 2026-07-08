import { Injectable } from '@nestjs/common';
import type { VideoProviderInfo } from '@odalyan/shared';
import { HeyGenProvider } from './heygen.provider';
import { RunwayProvider } from './runway.provider';
import { KlingProvider } from './kling.provider';
import type { VideoGenProvider } from './video-provider.interface';

@Injectable()
export class VideoRegistry {
  private readonly providers: VideoGenProvider[];

  constructor(heygen: HeyGenProvider, runway: RunwayProvider, kling: KlingProvider) {
    this.providers = [runway, kling, heygen];
  }

  get(id: string): VideoGenProvider | undefined {
    return this.providers.find((p) => p.id === id);
  }

  /** Métadonnées des fournisseurs pour l'UI. */
  list(): VideoProviderInfo[] {
    return this.providers.map((p) => ({
      id: p.id,
      label: p.label,
      description: p.description,
      kind: p.kind,
      enabled: p.enabled,
      needs: p.needs,
      options: p.options(),
    }));
  }
}
