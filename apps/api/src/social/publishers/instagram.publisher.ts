import { Injectable, Logger } from '@nestjs/common';
import type { SocialConnection } from '@prisma/client';
import type { OAuthResult, PublishInput, PublishResult, SocialPublisher } from './social-publisher.interface';

const IG_AUTH = 'https://www.instagram.com/oauth/authorize';
const IG_TOKEN = 'https://api.instagram.com/oauth/access_token';
const IG_GRAPH = 'https://graph.instagram.com';

/** Publication de contenu + lecture du profil (« Instagram API with Instagram login »). */
const SCOPES = ['instagram_business_basic', 'instagram_business_content_publish'].join(',');

interface IgEnvelope<T> {
  data?: T;
}

/**
 * Instagram via « API setup with Instagram login » : OAuth Instagram autonome
 * (endpoints graph.instagram.com), distincte de Facebook Login. Clés dédiées
 * INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET (≠ META_APP_*). Le compte Instagram doit
 * être professionnel. Jeton longue durée (60 j) renouvelable.
 */
@Injectable()
export class InstagramPublisher implements SocialPublisher {
  private readonly logger = new Logger(InstagramPublisher.name);
  readonly network = 'Instagram';
  readonly label = 'Instagram (Business)';
  readonly requirement =
    'App Instagram (API setup with Instagram login) + compte Instagram professionnel, ' +
    'avec permission instagram_business_content_publish.';

  get enabled(): boolean {
    return Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);
  }

  authorizeUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID!,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      state,
    });
    return `${IG_AUTH}?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthResult> {
    // 1) Code → jeton court (form-encoded). Instagram ajoute parfois un « #_ » final.
    const shortRes = await fetch(IG_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.INSTAGRAM_APP_ID!,
        client_secret: process.env.INSTAGRAM_APP_SECRET!,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: code.replace(/#_$/, ''),
      }),
    });
    const short = (await shortRes.json()) as {
      access_token?: string;
      user_id?: string;
      error_message?: string;
      error_type?: string;
    };
    if (!short.access_token) throw new Error(short.error_message ?? 'Échec de l’échange du code Instagram.');

    // 2) Jeton court → jeton longue durée (~60 jours)
    const longRes = await fetch(
      `${IG_GRAPH}/access_token?` +
        new URLSearchParams({
          grant_type: 'ig_exchange_token',
          client_secret: process.env.INSTAGRAM_APP_SECRET!,
          access_token: short.access_token,
        }),
    );
    const long = (await longRes.json()) as { access_token?: string; expires_in?: number };
    const token = long.access_token ?? short.access_token;

    // 3) Profil (id + pseudo)
    const meRes = await fetch(`${IG_GRAPH}/me?fields=user_id,username&access_token=${encodeURIComponent(token)}`);
    const me = (await meRes.json()) as { user_id?: string; id?: string; username?: string };
    const igId = me.user_id ?? me.id ?? (short.user_id ? String(short.user_id) : '');
    if (!igId) throw new Error('Compte Instagram introuvable.');

    return {
      accessToken: token,
      expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : undefined,
      accountName: me.username ? `@${me.username}` : 'Compte Instagram',
      externalId: igId,
      scope: SCOPES,
    };
  }

  /** Jeton longue durée renouvelable (ig_refresh_token) avant expiration. */
  async refresh(conn: SocialConnection): Promise<OAuthResult> {
    if (!conn.accessToken) throw new Error('Jeton Instagram manquant : reconnectez le compte.');
    const res = await fetch(
      `${IG_GRAPH}/refresh_access_token?` +
        new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: conn.accessToken }),
    );
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new Error('Renouvellement du jeton Instagram échoué.');
    return {
      accessToken: body.access_token,
      accountName: conn.accountName ?? 'Compte Instagram',
      externalId: conn.externalId ?? '',
      expiresAt: body.expires_in ? new Date(Date.now() + body.expires_in * 1000) : undefined,
      scope: SCOPES,
    };
  }

  async publish(conn: SocialConnection, input: PublishInput): Promise<PublishResult> {
    try {
      if (!conn.accessToken || !conn.externalId) throw new Error('Connexion Instagram incomplète.');
      if (!input.videoUrl && !input.imageUrl) throw new Error('Instagram exige une vidéo ou une image.');

      // 1) Conteneur : REELS pour la vidéo, image sinon
      const createBody = new URLSearchParams({ caption: input.caption, access_token: conn.accessToken });
      if (input.videoUrl) {
        createBody.set('media_type', 'REELS');
        createBody.set('video_url', input.videoUrl);
      } else {
        createBody.set('image_url', input.imageUrl!);
      }
      const createRes = await fetch(`${IG_GRAPH}/${conn.externalId}/media`, { method: 'POST', body: createBody });
      const created = (await createRes.json()) as { id?: string; error?: { message: string } };
      if (created.error || !created.id) throw new Error(created.error?.message ?? 'Conteneur Instagram refusé.');

      // 2) Vidéo : attendre l'encodage (traitement asynchrone)
      if (input.videoUrl) await this.waitContainerReady(created.id, conn.accessToken);

      // 3) Publication
      const pubRes = await fetch(`${IG_GRAPH}/${conn.externalId}/media_publish`, {
        method: 'POST',
        body: new URLSearchParams({ creation_id: created.id, access_token: conn.accessToken }),
      });
      const published = (await pubRes.json()) as { id?: string; error?: { message: string } };
      if (published.error || !published.id) throw new Error(published.error?.message ?? 'Publication Instagram refusée.');

      return { ok: true, externalId: published.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Instagram — publication échouée : ${message}`);
      return { ok: false, error: message };
    }
  }

  /** Attend que le conteneur vidéo soit encodé (status_code=FINISHED). */
  private async waitContainerReady(containerId: string, accessToken: string): Promise<void> {
    for (let i = 0; i < 20; i++) {
      const res = await fetch(
        `${IG_GRAPH}/${containerId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`,
      );
      const body = (await res.json()) as { status_code?: string };
      if (body.status_code === 'FINISHED') return;
      if (body.status_code === 'ERROR' || body.status_code === 'EXPIRED') {
        throw new Error(`Traitement vidéo Instagram échoué (${body.status_code}).`);
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error('Traitement de la vidéo Instagram trop long (réessayez).');
  }
}

// Réservé à un usage futur (typage des enveloppes graph.instagram.com).
export type { IgEnvelope };
