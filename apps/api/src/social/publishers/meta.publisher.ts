import { Injectable, Logger } from '@nestjs/common';
import type { SocialConnection } from '@prisma/client';
import type { OAuthResult, PublishInput, PublishResult, SocialPublisher } from './social-publisher.interface';

const GRAPH = 'https://graph.facebook.com/v21.0';
const DIALOG = 'https://www.facebook.com/v21.0/dialog/oauth';

/** Permissions nécessaires pour publier sur une Page et sur Instagram Business. */
const SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_content_publish',
].join(',');

interface MetaPage {
  id: string;
  name: string;
  access_token: string;
}

/**
 * Base commune Facebook/Instagram : une seule app Meta couvre les deux réseaux.
 * Le vendeur autorise sa Page ; on stocke le jeton de Page (longue durée) et,
 * pour Instagram, l'id du compte Business rattaché à cette Page.
 */
abstract class MetaBasePublisher implements SocialPublisher {
  protected readonly logger = new Logger(this.constructor.name);
  abstract readonly network: string;
  abstract readonly label: string;
  readonly requirement =
    'App Meta (Facebook Developers) + Page Facebook + compte Instagram Business lié, avec App Review pour la publication.';

  get enabled(): boolean {
    return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
  }

  authorizeUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      redirect_uri: redirectUri,
      state,
      scope: SCOPES,
      response_type: 'code',
    });
    return `${DIALOG}?${params}`;
  }

  /** Code → jeton utilisateur longue durée (~60 jours). */
  protected async longLivedUserToken(code: string, redirectUri: string): Promise<string> {
    const shortRes = await fetch(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          client_id: process.env.META_APP_ID!,
          client_secret: process.env.META_APP_SECRET!,
          redirect_uri: redirectUri,
          code,
        }),
    );
    const short = (await shortRes.json()) as { access_token?: string; error?: { message: string } };
    if (!short.access_token) throw new Error(short.error?.message ?? 'Échec de l’échange du code Meta');

    const longRes = await fetch(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: process.env.META_APP_ID!,
          client_secret: process.env.META_APP_SECRET!,
          fb_exchange_token: short.access_token,
        }),
    );
    const long = (await longRes.json()) as { access_token?: string };
    return long.access_token ?? short.access_token;
  }

  /** Première Page administrée par le vendeur (jeton de Page inclus). */
  protected async firstPage(userToken: string): Promise<MetaPage> {
    const res = await fetch(`${GRAPH}/me/accounts?access_token=${encodeURIComponent(userToken)}`);
    const data = (await res.json()) as { data?: MetaPage[]; error?: { message: string } };
    const page = data.data?.[0];
    if (!page) {
      throw new Error(
        data.error?.message ?? 'Aucune Page Facebook trouvée. Créez une Page et réessayez la connexion.',
      );
    }
    return page;
  }

  abstract exchangeCode(code: string, redirectUri: string): Promise<OAuthResult>;
  abstract publish(connection: SocialConnection, input: PublishInput): Promise<PublishResult>;

  protected fail(err: unknown): PublishResult {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`${this.network} — publication échouée : ${message}`);
    return { ok: false, error: message };
  }
}

/** Publication sur une Page Facebook. */
@Injectable()
export class FacebookPublisher extends MetaBasePublisher {
  readonly network = 'Facebook';
  readonly label = 'Facebook (Page)';

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthResult> {
    const userToken = await this.longLivedUserToken(code, redirectUri);
    const page = await this.firstPage(userToken);
    return {
      accessToken: page.access_token,
      accountName: page.name,
      externalId: page.id,
      scope: SCOPES,
    };
  }

  async publish(conn: SocialConnection, input: PublishInput): Promise<PublishResult> {
    try {
      if (!conn.accessToken || !conn.externalId) throw new Error('Connexion Facebook incomplète.');
      // Avec image → /photos (post photo légendé) ; sinon → /feed (texte seul)
      const endpoint = input.imageUrl ? `${GRAPH}/${conn.externalId}/photos` : `${GRAPH}/${conn.externalId}/feed`;
      const body = new URLSearchParams({ access_token: conn.accessToken });
      if (input.imageUrl) {
        body.set('url', input.imageUrl);
        body.set('caption', input.caption);
      } else {
        body.set('message', input.caption);
      }

      const res = await fetch(endpoint, { method: 'POST', body });
      const data = (await res.json()) as { id?: string; post_id?: string; error?: { message: string } };
      if (data.error) throw new Error(data.error.message);
      return { ok: true, externalId: data.post_id ?? data.id };
    } catch (err) {
      return this.fail(err);
    }
  }
}

/** Publication sur un compte Instagram Business (rattaché à une Page). */
@Injectable()
export class InstagramPublisher extends MetaBasePublisher {
  readonly network = 'Instagram';
  readonly label = 'Instagram (Business)';

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthResult> {
    const userToken = await this.longLivedUserToken(code, redirectUri);
    const page = await this.firstPage(userToken);

    const res = await fetch(
      `${GRAPH}/${page.id}?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(page.access_token)}`,
    );
    const data = (await res.json()) as {
      instagram_business_account?: { id: string; username?: string };
      error?: { message: string };
    };
    const ig = data.instagram_business_account;
    if (!ig) {
      throw new Error(
        data.error?.message ??
          'Aucun compte Instagram Business lié à votre Page. Liez-le dans les paramètres de la Page, puis réessayez.',
      );
    }
    return {
      accessToken: page.access_token,
      accountName: ig.username ? `@${ig.username}` : page.name,
      externalId: ig.id,
      scope: SCOPES,
    };
  }

  async publish(conn: SocialConnection, input: PublishInput): Promise<PublishResult> {
    try {
      if (!conn.accessToken || !conn.externalId) throw new Error('Connexion Instagram incomplète.');
      // Instagram exige une image : pas de publication texte seul
      if (!input.imageUrl) throw new Error('Instagram exige une image pour publier.');

      // 1) Conteneur média
      const createRes = await fetch(`${GRAPH}/${conn.externalId}/media`, {
        method: 'POST',
        body: new URLSearchParams({
          image_url: input.imageUrl,
          caption: input.caption,
          access_token: conn.accessToken,
        }),
      });
      const created = (await createRes.json()) as { id?: string; error?: { message: string } };
      if (created.error || !created.id) throw new Error(created.error?.message ?? 'Conteneur Instagram refusé.');

      // 2) Publication du conteneur
      const pubRes = await fetch(`${GRAPH}/${conn.externalId}/media_publish`, {
        method: 'POST',
        body: new URLSearchParams({ creation_id: created.id, access_token: conn.accessToken }),
      });
      const published = (await pubRes.json()) as { id?: string; error?: { message: string } };
      if (published.error || !published.id) throw new Error(published.error?.message ?? 'Publication Instagram refusée.');

      return { ok: true, externalId: published.id };
    } catch (err) {
      return this.fail(err);
    }
  }
}
