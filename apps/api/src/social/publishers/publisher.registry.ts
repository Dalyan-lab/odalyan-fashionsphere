import { Injectable } from '@nestjs/common';
import { SocialNetwork } from '@odalyan/shared';
import { FacebookPublisher, InstagramPublisher } from './meta.publisher';
import type { SocialPublisher } from './social-publisher.interface';

/** Ce qu'il faut obtenir pour les réseaux dont le provider n'est pas encore écrit. */
const PENDING_REQUIREMENTS: Record<string, string> = {
  [SocialNetwork.TIKTOK]:
    'App TikTok for Developers + audit de l’API « Content Posting » (publication directe).',
  [SocialNetwork.YOUTUBE]:
    'Projet Google Cloud + YouTube Data API v3 (scope d’upload sensible → vérification Google).',
  [SocialNetwork.PINTEREST]: 'App Pinterest Developers approuvée (accès API standard).',
  [SocialNetwork.X]: 'API X v2 — le niveau permettant de publier est payant (~100 $/mois).',
};

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

  constructor(facebook: FacebookPublisher, instagram: InstagramPublisher) {
    this.publishers = [facebook, instagram];
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
