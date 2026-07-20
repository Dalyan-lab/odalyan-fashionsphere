import type { SocialConnection } from '@prisma/client';

/** Jetons et identité renvoyés par le réseau après l'échange du code OAuth. */
export interface OAuthResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  accountName: string;
  /** Id côté réseau (Page Facebook, compte Instagram Business, chaîne YouTube…). */
  externalId?: string;
  scope?: string;
}

export interface PublishInput {
  caption: string;
  imageUrl?: string | null;
  /** Vidéo à publier (TikTok, Reels…). Prioritaire sur l'image quand le réseau la gère. */
  videoUrl?: string | null;
}

export interface PublishResult {
  ok: boolean;
  /** Id du post créé côté réseau (permet d'y revenir). */
  externalId?: string;
  error?: string;
}

/**
 * Contrat commun à tous les réseaux de publication.
 * Un provider est « enabled » quand les clés de l'app développeur sont présentes ;
 * sinon la connexion reste simulée et la publication renvoie une erreur explicite.
 */
export interface SocialPublisher {
  readonly network: string; // doit correspondre à SocialNetwork (ex: 'Instagram')
  readonly label: string;
  /** Vrai si l'app développeur est configurée (clés d'environnement présentes). */
  readonly enabled: boolean;
  /** Ce que l'utilisateur doit faire pour l'activer (affiché dans l'UI). */
  readonly requirement: string;

  /** URL vers laquelle rediriger le vendeur pour autoriser son compte. */
  authorizeUrl(redirectUri: string, state: string): string;
  /** Échange le code d'autorisation contre des jetons durables. */
  exchangeCode(code: string, redirectUri: string): Promise<OAuthResult>;
  /** Publie réellement le contenu sur le compte connecté. */
  publish(connection: SocialConnection, input: PublishInput): Promise<PublishResult>;

  /**
   * Renouvelle un jeton expiré à partir du refreshToken.
   * À implémenter par les réseaux à jetons courts (TikTok : 24 h, YouTube : 1 h).
   * Absent = jeton longue durée, rien à faire (cas de Meta).
   */
  refresh?(connection: SocialConnection): Promise<OAuthResult>;
}
