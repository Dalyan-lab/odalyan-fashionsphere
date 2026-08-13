import { Injectable } from '@nestjs/common';
import { SocialNetwork } from '@odalyan/shared';
import { FacebookPublisher } from './meta.publisher';
import { InstagramPublisher } from './instagram.publisher';
import { TikTokPublisher } from './tiktok.publisher';
import { YouTubePublisher } from './youtube.publisher';
import { PinterestPublisher } from './pinterest.publisher';
import { LinkedInPublisher } from './linkedin.publisher';
import type { SocialPublisher } from './social-publisher.interface';

/** Ce qu'il faut obtenir pour les réseaux dont le provider n'est pas encore écrit. */
const PENDING_REQUIREMENTS: Record<string, string> = {};

export interface NetworkStatus {
  network: string;
  label: string;
  /** Un provider de publication est écrit pour ce réseau. */
  supported: boolean;
  /** L'app développeur est configurée (clés présentes) → publication réelle possible. */
  enabled: boolean;
  requirement: string;
}

@Injectable()
export class PublisherRegistry {
  private readonly publishers: SocialPublisher[];

  constructor(
    facebook: FacebookPublisher,
    instagram: InstagramPublisher,
    tiktok: TikTokPublisher,
    youtube: YouTubePublisher,
    pinterest: PinterestPublisher,
    linkedin: LinkedInPublisher,
  ) {
    this.publishers = [facebook, instagram, tiktok, youtube, pinterest, linkedin];
  }

  get(network: string): SocialPublisher | undefined {
    return this.publishers.find((p) => p.network === network);
  }

  /** État de tous les réseaux, pour l'UI de connexion. */
  list(): NetworkStatus[] {
    return Object.values(SocialNetwork).map((network) => {
      const p = this.get(network);
      return {
        network,
        label: p?.label ?? network,
        supported: Boolean(p),
        enabled: p?.enabled ?? false,
        requirement: p?.requirement ?? PENDING_REQUIREMENTS[network] ?? 'Provider à construire.',
      };
    });
  }
}
