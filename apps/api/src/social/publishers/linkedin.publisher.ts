import { Injectable, Logger } from '@nestjs/common';
import type { SocialConnection } from '@prisma/client';
import type {
  OAuthResult,
  PublishInput,
  PublishResult,
  SocialPublisher,
} from './social-publisher.interface';

const AUTH = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN = 'https://www.linkedin.com/oauth/v2/accessToken';
const API = 'https://api.linkedin.com';

/**
 * `w_member_social` publie au nom du membre ; `openid` et `profile` servent
 * uniquement à récupérer son identifiant, indispensable pour signer la
 * publication.
 */
const SCOPES = ['openid', 'profile', 'w_member_social'].join(' ');

/**
 * L'API LinkedIn est versionnée par date : chaque appel doit annoncer la
 * version utilisée. Surchargeable si LinkedIn retire une version ancienne.
 */
const DEFAULT_VERSION = '202405';

interface LinkedInTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

/**
 * Publication sur LinkedIn (profil membre) via l'API Posts.
 *
 * Trois particularités par rapport aux autres réseaux :
 *  - chaque requête doit porter l'en-tête `LinkedIn-Version` ;
 *  - l'auteur est un identifiant de la forme `urn:li:person:{id}`, obtenu au
 *    moment de la connexion et conservé dans `externalId` ;
 *  - l'image n'est pas envoyée avec la publication : on demande d'abord une
 *    URL d'envoi, on y pousse les octets, puis on référence l'image obtenue.
 */
@Injectable()
export class LinkedInPublisher implements SocialPublisher {
  private readonly logger = new Logger(LinkedInPublisher.name);
  readonly network = 'LinkedIn';
  readonly label = 'LinkedIn';
  readonly requirement =
    'App LinkedIn Developers avec le produit « Share on LinkedIn ». ' +
    'Clés LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET. Publie du texte et des images ' +
    'sur votre profil ; le jeton dure 60 jours.';

  get enabled(): boolean {
    return Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
  }

  private get version(): string {
    return process.env.LINKEDIN_API_VERSION ?? DEFAULT_VERSION;
  }

  /** En-têtes communs à tous les appels de l'API versionnée. */
  private headers(accessToken: string, json = true): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      'LinkedIn-Version': this.version,
      'X-Restli-Protocol-Version': '2.0.0',
      ...(json ? { 'Content-Type': 'application/json' } : {}),
    };
  }

  authorizeUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      redirect_uri: redirectUri,
      state,
      scope: SCOPES,
    });
    return `${AUTH}?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthResult> {
    const res = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    });
    const t = (await res.json()) as LinkedInTokenResponse;
    if (!t.access_token) {
      throw new Error(t.error_description ?? t.error ?? 'Échec de l’échange du jeton LinkedIn.');
    }

    // Identité du membre : `sub` est l'identifiant qui compose l'URN d'auteur.
    const meRes = await fetch(`${API}/v2/userinfo`, {
      headers: { Authorization: `Bearer ${t.access_token}` },
    });
    const me = (await meRes.json()) as { sub?: string; name?: string };
    if (!me.sub) throw new Error('Profil LinkedIn introuvable : autorisation incomplète.');

    return {
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt: t.expires_in ? new Date(Date.now() + t.expires_in * 1000) : undefined,
      accountName: me.name ?? 'Profil LinkedIn',
      externalId: me.sub,
      scope: t.scope ?? SCOPES,
    };
  }

  /**
   * Le renouvellement n'est ouvert qu'aux applications validées par LinkedIn.
   * Sans refresh token, la reconnexion manuelle reste nécessaire tous les 60 jours.
   */
  async refresh(conn: SocialConnection): Promise<OAuthResult> {
    if (!conn.refreshToken) {
      throw new Error('Jeton LinkedIn expiré : reconnectez le compte (renouvellement non accordé à cette app).');
    }
    const res = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: conn.refreshToken,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    });
    const t = (await res.json()) as LinkedInTokenResponse;
    if (!t.access_token) throw new Error(t.error_description ?? 'Renouvellement du jeton LinkedIn échoué.');
    return {
      accessToken: t.access_token,
      refreshToken: t.refresh_token ?? conn.refreshToken,
      expiresAt: t.expires_in ? new Date(Date.now() + t.expires_in * 1000) : undefined,
      accountName: conn.accountName ?? 'Profil LinkedIn',
      externalId: conn.externalId ?? undefined,
      scope: t.scope ?? conn.scope ?? SCOPES,
    };
  }

  /**
   * Envoie une image et renvoie son URN, à référencer dans la publication.
   * LinkedIn impose ce détour : on demande une URL, on y pousse les octets.
   */
  private async uploadImage(accessToken: string, author: string, imageUrl: string): Promise<string> {
    const initRes = await fetch(`${API}/rest/images?action=initializeUpload`, {
      method: 'POST',
      headers: this.headers(accessToken),
      body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
    });
    const init = (await initRes.json()) as {
      value?: { uploadUrl?: string; image?: string };
      message?: string;
    };
    const uploadUrl = init.value?.uploadUrl;
    const imageUrn = init.value?.image;
    if (!uploadUrl || !imageUrn) {
      throw new Error(init.message ?? `LinkedIn a refusé l’envoi de l’image (HTTP ${initRes.status}).`);
    }

    const srcRes = await fetch(imageUrl);
    if (!srcRes.ok) throw new Error(`Image inaccessible (HTTP ${srcRes.status}).`);
    const bytes = Buffer.from(await srcRes.arrayBuffer());

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: bytes,
    });
    if (!putRes.ok) throw new Error(`Envoi de l’image à LinkedIn échoué (HTTP ${putRes.status}).`);

    return imageUrn;
  }

  async publish(conn: SocialConnection, input: PublishInput): Promise<PublishResult> {
    try {
      if (!conn.accessToken || !conn.externalId) throw new Error('Connexion LinkedIn incomplète.');
      if (input.videoUrl && !input.imageUrl) {
        throw new Error(
          'LinkedIn publie du texte et des images : ajoutez une image, ou retirez LinkedIn de la sélection.',
        );
      }

      const author = `urn:li:person:${conn.externalId}`;
      const imageUrn = input.imageUrl ? await this.uploadImage(conn.accessToken, author, input.imageUrl) : null;

      const res = await fetch(`${API}/rest/posts`, {
        method: 'POST',
        headers: this.headers(conn.accessToken),
        body: JSON.stringify({
          author,
          commentary: input.caption.slice(0, 3000),
          visibility: 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          ...(imageUrn ? { content: { media: { id: imageUrn } } } : {}),
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        }),
      });

      // L'identifiant du post arrive dans un en-tête, pas dans le corps.
      const postId = res.headers.get('x-restli-id');
      if (!res.ok || !postId) {
        const detail = await res.text();
        throw new Error(`Publication refusée (HTTP ${res.status}) : ${detail.slice(0, 200)}`);
      }

      return { ok: true, externalId: postId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`LinkedIn — publication échouée : ${message}`);
      return { ok: false, error: message };
    }
  }
}
