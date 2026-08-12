import { Injectable, Logger } from '@nestjs/common';
import type { SocialConnection } from '@prisma/client';
import type {
  InsightResult,
  OAuthResult,
  PublishInput,
  PublishResult,
  SocialPublisher,
} from './social-publisher.interface';

const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/youtube/v3';
const UPLOAD = 'https://www.googleapis.com/upload/youtube/v3/videos';

/**
 * `youtube.upload` permet de publier ; `youtube.readonly` sert seulement à lire
 * le nom de la chaîne et les statistiques des vidéos publiées.
 */
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
].join(' ');

/**
 * Tant que l'application n'a pas passé la vérification Google pour le scope
 * d'upload (considéré comme sensible), YouTube force les vidéos envoyées à
 * rester privées. Après vérification : passer YOUTUBE_PRIVACY_STATUS à `public`.
 */
const DEFAULT_PRIVACY = 'private';

/** Limites imposées par l'API YouTube sur les métadonnées. */
const MAX_TITLE = 100;
const MAX_DESCRIPTION = 5000;

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

/**
 * Publication sur YouTube via la Data API v3.
 *
 * Deux particularités par rapport aux autres réseaux :
 *  - le jeton d'accès ne vit qu'une heure → `refresh()` est indispensable, et
 *    l'autorisation doit demander `access_type=offline` + `prompt=consent`
 *    pour obtenir un refresh token durable ;
 *  - l'envoi se fait en deux temps (upload « résumable ») : on déclare d'abord
 *    les métadonnées, YouTube renvoie une URL, puis on y pousse les octets.
 */
@Injectable()
export class YouTubePublisher implements SocialPublisher {
  private readonly logger = new Logger(YouTubePublisher.name);
  readonly network = 'YouTube';
  readonly label = 'YouTube';
  readonly requirement =
    'Projet Google Cloud avec YouTube Data API v3 activée. Le scope d’upload est sensible : ' +
    'avant la vérification Google, les vidéos envoyées restent privées. ' +
    'Clés YOUTUBE_CLIENT_ID/SECRET, ou à défaut celles de la connexion Google.';

  /** Réutilise les clés de la connexion Google si aucune clé dédiée n'est fournie. */
  private get clientId(): string | undefined {
    return process.env.YOUTUBE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
  }

  private get clientSecret(): string | undefined {
    return process.env.YOUTUBE_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
  }

  get enabled(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  authorizeUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId!,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      state,
      // Sans ces deux paramètres, Google ne renvoie pas de refresh token et la
      // connexion cesse de fonctionner au bout d'une heure.
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    });
    return `${AUTH}?${params}`;
  }

  /** Appel du point /token (échange initial ou renouvellement). */
  private async token(body: Record<string, string>): Promise<GoogleTokenResponse> {
    const res = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId!,
        client_secret: this.clientSecret!,
        ...body,
      }),
    });
    const data = (await res.json()) as GoogleTokenResponse;
    if (!data.access_token) {
      throw new Error(data.error_description ?? data.error ?? 'Échec de l’échange du jeton YouTube.');
    }
    return data;
  }

  /** Nom de la chaîne, pour l'afficher dans l'interface. */
  private async channel(accessToken: string): Promise<{ name: string; id?: string }> {
    try {
      const res = await fetch(`${API}/channels?part=snippet&mine=true`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = (await res.json()) as { items?: { id?: string; snippet?: { title?: string } }[] };
      const item = body.items?.[0];
      return { name: item?.snippet?.title ?? 'Chaîne YouTube', id: item?.id };
    } catch {
      return { name: 'Chaîne YouTube' }; // accessoire : ne doit pas faire échouer la connexion
    }
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthResult> {
    const t = await this.token({ code, grant_type: 'authorization_code', redirect_uri: redirectUri });
    const chan = await this.channel(t.access_token!);
    return {
      accessToken: t.access_token!,
      refreshToken: t.refresh_token,
      expiresAt: t.expires_in ? new Date(Date.now() + t.expires_in * 1000) : undefined,
      accountName: chan.name,
      externalId: chan.id,
      scope: t.scope ?? SCOPES,
    };
  }

  async refresh(conn: SocialConnection): Promise<OAuthResult> {
    if (!conn.refreshToken) {
      throw new Error('Jeton YouTube expiré : reconnectez le compte pour renouveler l’autorisation.');
    }
    const t = await this.token({ grant_type: 'refresh_token', refresh_token: conn.refreshToken });
    return {
      accessToken: t.access_token!,
      // Google ne renvoie pas de nouveau refresh token : on conserve l'existant.
      refreshToken: t.refresh_token ?? conn.refreshToken,
      expiresAt: t.expires_in ? new Date(Date.now() + t.expires_in * 1000) : undefined,
      accountName: conn.accountName ?? 'Chaîne YouTube',
      externalId: conn.externalId ?? undefined,
      scope: t.scope ?? conn.scope ?? SCOPES,
    };
  }

  /**
   * Découpe la légende en titre et description : YouTube exige un titre court,
   * on prend donc la première ligne (ou les 100 premiers caractères).
   */
  private splitCaption(caption: string): { title: string; description: string } {
    const firstLine = caption.split('\n')[0]?.trim() || 'Nouvelle vidéo';
    return {
      title: firstLine.slice(0, MAX_TITLE),
      description: caption.slice(0, MAX_DESCRIPTION),
    };
  }

  async publish(conn: SocialConnection, input: PublishInput): Promise<PublishResult> {
    try {
      if (!conn.accessToken) throw new Error('Connexion YouTube incomplète.');
      if (!input.videoUrl) throw new Error('YouTube exige une vidéo.');

      // 1) Récupère les octets depuis le stockage (R2)
      const videoRes = await fetch(input.videoUrl);
      if (!videoRes.ok) throw new Error(`Vidéo inaccessible (HTTP ${videoRes.status}).`);
      const bytes = Buffer.from(await videoRes.arrayBuffer());
      if (bytes.length === 0) throw new Error('La vidéo est vide.');

      const { title, description } = this.splitCaption(input.caption);

      // 2) Déclare les métadonnées ; YouTube répond avec l'URL d'envoi.
      const initRes = await fetch(`${UPLOAD}?uploadType=resumable&part=snippet,status`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${conn.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'video/*',
          'X-Upload-Content-Length': String(bytes.length),
        },
        body: JSON.stringify({
          snippet: { title, description },
          status: {
            privacyStatus: process.env.YOUTUBE_PRIVACY_STATUS ?? DEFAULT_PRIVACY,
            selfDeclaredMadeForKids: false,
          },
        }),
      });
      if (!initRes.ok) {
        const detail = await initRes.text();
        throw new Error(`Initialisation refusée (HTTP ${initRes.status}) : ${detail.slice(0, 200)}`);
      }
      const uploadUrl = initRes.headers.get('location');
      if (!uploadUrl) throw new Error('YouTube n’a pas renvoyé d’URL d’envoi.');

      // 3) Pousse les octets vers l'URL fournie.
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'video/*', 'Content-Length': String(bytes.length) },
        body: bytes,
      });
      const created = (await putRes.json()) as { id?: string; error?: { message?: string } };
      if (created.error || !created.id) {
        throw new Error(created.error?.message ?? `Envoi refusé (HTTP ${putRes.status}).`);
      }

      return { ok: true, externalId: created.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`YouTube — publication échouée : ${message}`);
      return { ok: false, error: message };
    }
  }

  /** Statistiques d'une vidéo (vues, j'aime, commentaires). */
  async fetchInsights(conn: SocialConnection, externalId: string): Promise<InsightResult> {
    if (!conn.accessToken) throw new Error('Connexion YouTube incomplète.');
    const res = await fetch(`${API}/videos?part=statistics&id=${encodeURIComponent(externalId)}`, {
      headers: { Authorization: `Bearer ${conn.accessToken}` },
    });
    const body = (await res.json()) as {
      items?: { statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }[];
      error?: { message?: string };
    };
    if (body.error) throw new Error(body.error.message ?? 'Statistiques YouTube indisponibles.');

    const stats = body.items?.[0]?.statistics;
    if (!stats) throw new Error('Vidéo YouTube introuvable (supprimée ?).');

    return {
      views: Number(stats.viewCount ?? 0),
      likes: Number(stats.likeCount ?? 0),
      comments: Number(stats.commentCount ?? 0),
      // YouTube n'expose pas le nombre de partages via cette API.
      partial: 'Partages non fournis par l’API YouTube',
    };
  }
}
