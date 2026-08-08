import { Injectable, Logger } from '@nestjs/common';
import type { SocialConnection } from '@prisma/client';
import type {
  InsightResult,
  OAuthResult,
  PublishInput,
  PublishResult,
  SocialPublisher,
} from './social-publisher.interface';

const GRAPH = 'https://graph.facebook.com/v21.0';
const DIALOG = 'https://www.facebook.com/v21.0/dialog/oauth';

/** Permissions nécessaires pour publier sur une Page et sur Instagram Business. */
const SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_content_publish',
  'read_insights', // statistiques des publications de la Page
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
      response_type: 'code',
    });
    // « Facebook Login for Business » : les permissions viennent d'une Configuration
    // (config_id) et non du paramètre scope (sinon « Invalid Scopes »). L'ancien flux
    // scope reste dispo pour une app « Facebook Login » classique (sans META_CONFIG_ID).
    if (process.env.META_CONFIG_ID) {
      params.set('config_id', process.env.META_CONFIG_ID);
    } else {
      params.set('scope', SCOPES);
    }
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

    // Facebook Login for Business : le jeton est DÉJÀ longue durée. L'échange
    // fb_exchange_token lui fait perdre l'accès aux Pages gérées via un business
    // (→ /me/accounts vide). On garde donc le jeton tel quel avec config_id.
    if (process.env.META_CONFIG_ID) return short.access_token;

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
    // 1) Voie classique : Pages directement gérées par le profil.
    const res = await fetch(
      `${GRAPH}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(userToken)}`,
    );
    const raw = await res.text();
    let data: { data?: MetaPage[]; error?: { message: string } } = {};
    try {
      data = JSON.parse(raw) as typeof data;
    } catch {
      /* réponse non-JSON */
    }
    if (data.data?.[0]) return data.data[0];

    // 2) Page détenue par un business (FBLB) : /me/accounts est vide. On découvre
    //    l'id de la Page via les granular_scopes du jeton, puis on récupère la Page.
    const pageId = await this.grantedPageId(userToken);
    if (pageId) {
      const pRes = await fetch(
        `${GRAPH}/${pageId}?fields=id,name,access_token&access_token=${encodeURIComponent(userToken)}`,
      );
      const page = (await pRes.json()) as MetaPage & { error?: { message: string } };
      if (page.id && page.access_token) return page;
      if (page.error) throw new Error(page.error.message);
    }

    const detail = data.error?.message ?? `réponse /me/accounts: ${raw.slice(0, 180)}`;
    throw new Error(`Aucune Page Facebook accessible. ${detail}`);
  }

  /** Id de la première Page accordée au jeton (via debug_token → granular_scopes). */
  private async grantedPageId(userToken: string): Promise<string | null> {
    const appToken = `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`;
    const res = await fetch(
      `${GRAPH}/debug_token?input_token=${encodeURIComponent(userToken)}&access_token=${encodeURIComponent(appToken)}`,
    );
    const body = (await res.json()) as {
      data?: { granular_scopes?: { scope: string; target_ids?: string[] }[] };
    };
    for (const s of body.data?.granular_scopes ?? []) {
      if (s.target_ids?.length) return s.target_ids[0];
    }
    return null;
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

      // Vidéo → /videos : Facebook récupère le fichier depuis l'URL (R2).
      if (input.videoUrl) {
        const res = await fetch(`${GRAPH}/${conn.externalId}/videos`, {
          method: 'POST',
          body: new URLSearchParams({
            access_token: conn.accessToken,
            file_url: input.videoUrl,
            description: input.caption,
          }),
        });
        const data = (await res.json()) as { id?: string; error?: { message: string } };
        if (data.error) throw new Error(data.error.message);
        return { ok: true, externalId: data.id };
      }

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

  /**
   * Statistiques d'un post de Page. L'engagement (j'aime / commentaires / partages)
   * ne demande que `pages_read_engagement` ; les impressions passent par /insights
   * et exigent `read_insights`. Si cette permission manque, on renvoie quand même
   * l'engagement en signalant ce qui n'a pas pu être lu.
   */
  async fetchInsights(conn: SocialConnection, externalId: string): Promise<InsightResult> {
    if (!conn.accessToken) throw new Error('Connexion Facebook incomplète.');
    const token = encodeURIComponent(conn.accessToken);

    const engRes = await fetch(
      `${GRAPH}/${externalId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${token}`,
    );
    const eng = (await engRes.json()) as {
      likes?: { summary?: { total_count?: number } };
      comments?: { summary?: { total_count?: number } };
      shares?: { count?: number };
      error?: { message: string };
    };
    if (eng.error) throw new Error(eng.error.message);

    const result: InsightResult = {
      likes: eng.likes?.summary?.total_count ?? 0,
      comments: eng.comments?.summary?.total_count ?? 0,
      shares: eng.shares?.count ?? 0,
    };

    // Impressions : métrique séparée, souvent refusée faute de permission → non bloquante.
    try {
      const insRes = await fetch(
        `${GRAPH}/${externalId}/insights?metric=post_impressions,post_impressions_unique&access_token=${token}`,
      );
      const ins = (await insRes.json()) as {
        data?: { name: string; values?: { value?: number }[] }[];
        error?: { message: string };
      };
      if (ins.error) throw new Error(ins.error.message);
      const read = (name: string) => ins.data?.find((d) => d.name === name)?.values?.[0]?.value;
      result.views = read('post_impressions') ?? 0;
      result.reach = read('post_impressions_unique') ?? 0;
    } catch (err) {
      result.partial = `Impressions indisponibles (${err instanceof Error ? err.message : String(err)})`;
    }

    return result;
  }
}
