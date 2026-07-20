import { Injectable, Logger } from '@nestjs/common';
import type { SocialConnection } from '@prisma/client';
import type { OAuthResult, PublishInput, PublishResult, SocialPublisher } from './social-publisher.interface';

const AUTH = 'https://www.tiktok.com/v2/auth/authorize/';
const API = 'https://open.tiktokapis.com/v2';

/** Lecture du profil + publication directe de contenu. */
const SCOPES = ['user.info.basic', 'video.publish'].join(',');

/**
 * Tant que l'app n'a pas passé l'audit « Content Posting API », TikTok impose
 * que les publications directes restent privées (SELF_ONLY) — toute autre valeur
 * est rejetée. Après l'audit : passer TIKTOK_PRIVACY_LEVEL à PUBLIC_TO_EVERYONE.
 */
const DEFAULT_PRIVACY = 'SELF_ONLY';

/** Enveloppe commune des réponses TikTok : error.code vaut 'ok' en cas de succès. */
interface TikTokEnvelope<T> {
  data?: T;
  error?: { code?: string; message?: string };
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  open_id?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

/**
 * Publication sur TikTok via la Content Posting API.
 *
 * Deux différences majeures avec Meta :
 *  - les jetons expirent en 24 h → refresh() est implémenté (refresh token valable 1 an) ;
 *  - l'image est récupérée par TikTok depuis son URL (PULL_FROM_URL), ce qui exige
 *    que le domaine qui l'héberge soit vérifié dans le portail développeur.
 */
@Injectable()
export class TikTokPublisher implements SocialPublisher {
  private readonly logger = new Logger(TikTokPublisher.name);
  readonly network = 'TikTok';
  readonly label = 'TikTok';
  readonly requirement =
    'App TikTok for Developers (Content Posting API) + domaine des vidéos/images vérifié. ' +
    'Avant l’audit, les publications restent privées (SELF_ONLY).';

  get enabled(): boolean {
    return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
  }

  authorizeUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      redirect_uri: redirectUri,
      state,
      scope: SCOPES,
      response_type: 'code',
    });
    return `${AUTH}?${params}`;
  }

  /** Appel du point /oauth/token/ (échange initial ou renouvellement). */
  private async token(body: Record<string, string>): Promise<TokenResponse> {
    const res = await fetch(`${API}/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        ...body,
      }),
    });
    const data = (await res.json()) as TokenResponse;
    if (!data.access_token) {
      throw new Error(data.error_description ?? data.error ?? 'Échec de l’échange du jeton TikTok.');
    }
    return data;
  }

  /** Nom d'affichage du créateur, pour l'afficher dans l'interface. */
  private async displayName(accessToken: string, fallback: string): Promise<string> {
    try {
      const res = await fetch(`${API}/user/info/?fields=display_name,username`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = (await res.json()) as TikTokEnvelope<{ user?: { display_name?: string; username?: string } }>;
      const user = body.data?.user;
      if (user?.username) return `@${user.username}`;
      return user?.display_name ?? fallback;
    } catch {
      return fallback; // le profil est accessoire : ne pas faire échouer la connexion
    }
  }

  private toOAuthResult(t: TokenResponse, accountName: string): OAuthResult {
    return {
      accessToken: t.access_token!,
      refreshToken: t.refresh_token,
      expiresAt: t.expires_in ? new Date(Date.now() + t.expires_in * 1000) : undefined,
      accountName,
      externalId: t.open_id,
      scope: t.scope ?? SCOPES,
    };
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthResult> {
    const t = await this.token({ code, grant_type: 'authorization_code', redirect_uri: redirectUri });
    const accountName = await this.displayName(t.access_token!, 'Compte TikTok');
    return this.toOAuthResult(t, accountName);
  }

  async refresh(conn: SocialConnection): Promise<OAuthResult> {
    if (!conn.refreshToken) throw new Error('Jeton TikTok expiré : reconnectez le compte.');
    const t = await this.token({ grant_type: 'refresh_token', refresh_token: conn.refreshToken });
    return this.toOAuthResult(t, conn.accountName ?? 'Compte TikTok');
  }

  async publish(conn: SocialConnection, input: PublishInput): Promise<PublishResult> {
    try {
      if (!conn.accessToken) throw new Error('Connexion TikTok incomplète.');
      // TikTok privilégie la vidéo (sa raison d'être) ; à défaut, carrousel photo.
      if (input.videoUrl) return await this.publishVideo(conn.accessToken, input.videoUrl, input.caption);
      if (input.imageUrl) return await this.publishPhoto(conn.accessToken, input.imageUrl, input.caption);
      throw new Error('TikTok exige une vidéo ou une image pour publier.');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`TikTok — publication échouée : ${message}`);
      return { ok: false, error: message };
    }
  }

  /** Champs communs post_info aux deux types de contenu. */
  private postInfo(caption: string) {
    return {
      // Le titre alimente le fil ; la description porte la légende complète.
      title: caption.slice(0, 90),
      description: caption.slice(0, 4000),
      privacy_level: process.env.TIKTOK_PRIVACY_LEVEL ?? DEFAULT_PRIVACY,
      disable_comment: false,
    };
  }

  /** Appel d'un point /init/ et extraction du publish_id. */
  private async initPublish(accessToken: string, endpoint: string, payload: unknown): Promise<PublishResult> {
    const res = await fetch(`${API}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as TikTokEnvelope<{ publish_id?: string }>;
    if (body.error?.code && body.error.code !== 'ok') {
      throw new Error(body.error.message || body.error.code);
    }
    const publishId = body.data?.publish_id;
    if (!publishId) throw new Error('TikTok n’a pas renvoyé d’identifiant de publication.');
    return { ok: true, externalId: publishId };
  }

  private publishVideo(accessToken: string, videoUrl: string, caption: string): Promise<PublishResult> {
    return this.initPublish(accessToken, '/post/publish/video/init/', {
      post_info: { ...this.postInfo(caption), auto_add_music: false },
      source_info: { source: 'PULL_FROM_URL', video_url: videoUrl },
    });
  }

  private publishPhoto(accessToken: string, imageUrl: string, caption: string): Promise<PublishResult> {
    return this.initPublish(accessToken, '/post/publish/content/init/', {
      media_type: 'PHOTO',
      post_mode: 'DIRECT_POST',
      post_info: { ...this.postInfo(caption), auto_add_music: true },
      source_info: { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: [imageUrl] },
    });
  }
}
