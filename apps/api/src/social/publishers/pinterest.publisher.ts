import { Injectable, Logger } from '@nestjs/common';
import type { SocialConnection } from '@prisma/client';
import type {
  InsightResult,
  OAuthResult,
  PublishInput,
  PublishResult,
  SocialPublisher,
} from './social-publisher.interface';

const AUTH = 'https://www.pinterest.com/oauth/';
const API = 'https://api.pinterest.com/v5';

/**
 * `pins:write` publie ; `boards:read` sert à retrouver le tableau de destination ;
 * `user_accounts:read` donne le nom du compte ; `pins:read` lit les statistiques.
 */
const SCOPES = ['boards:read', 'pins:read', 'pins:write', 'user_accounts:read'].join(',');

interface PinterestTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  message?: string;
  error?: string;
  error_description?: string;
}

/**
 * Publication sur Pinterest via l'API v5.
 *
 * Deux particularités :
 *  - une épingle appartient obligatoirement à un **tableau** ; on mémorise donc
 *    l'identifiant du premier tableau du compte au moment de la connexion, et
 *    on le réutilise à chaque publication ;
 *  - Pinterest récupère l'image depuis son URL (`image_url`), il n'y a donc pas
 *    d'envoi d'octets — mais l'URL doit être publiquement accessible.
 */
@Injectable()
export class PinterestPublisher implements SocialPublisher {
  private readonly logger = new Logger(PinterestPublisher.name);
  readonly network = 'Pinterest';
  readonly label = 'Pinterest';
  readonly requirement =
    'App Pinterest Developers (accès Trial suffisant pour votre propre compte). ' +
    'Clés PINTEREST_APP_ID / PINTEREST_APP_SECRET. Publie des images : ' +
    'une épingle est déposée sur le premier tableau du compte.';

  get enabled(): boolean {
    return Boolean(process.env.PINTEREST_APP_ID && process.env.PINTEREST_APP_SECRET);
  }

  authorizeUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.PINTEREST_APP_ID!,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      state,
    });
    return `${AUTH}?${params}`;
  }

  /**
   * Pinterest exige l'authentification « Basic » sur le point /oauth/token :
   * les identifiants de l'app vont dans l'en-tête, pas dans le corps.
   */
  private async token(body: Record<string, string>): Promise<PinterestTokenResponse> {
    const basic = Buffer.from(
      `${process.env.PINTEREST_APP_ID}:${process.env.PINTEREST_APP_SECRET}`,
    ).toString('base64');
    const res = await fetch(`${API}/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body),
    });
    const data = (await res.json()) as PinterestTokenResponse;
    if (!data.access_token) {
      throw new Error(
        data.error_description ?? data.message ?? data.error ?? 'Échec de l’échange du jeton Pinterest.',
      );
    }
    return data;
  }

  /** Pseudo du compte, pour l'afficher dans l'interface. */
  private async username(accessToken: string): Promise<string> {
    try {
      const res = await fetch(`${API}/user_account`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = (await res.json()) as { username?: string };
      return body.username ? `@${body.username}` : 'Compte Pinterest';
    } catch {
      return 'Compte Pinterest';
    }
  }

  /**
   * Premier tableau du compte : une épingle ne peut pas exister sans tableau.
   * Renvoie null si le compte n'en a aucun — la publication le signalera.
   */
  private async firstBoardId(accessToken: string): Promise<string | null> {
    try {
      const res = await fetch(`${API}/boards?page_size=1`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = (await res.json()) as { items?: { id?: string }[] };
      return body.items?.[0]?.id ?? null;
    } catch {
      return null;
    }
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthResult> {
    const t = await this.token({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });
    const [accountName, boardId] = await Promise.all([
      this.username(t.access_token!),
      this.firstBoardId(t.access_token!),
    ]);
    return {
      accessToken: t.access_token!,
      refreshToken: t.refresh_token,
      expiresAt: t.expires_in ? new Date(Date.now() + t.expires_in * 1000) : undefined,
      accountName,
      // On mémorise le tableau de destination : il est requis à chaque épingle.
      externalId: boardId ?? undefined,
      scope: t.scope ?? SCOPES,
    };
  }

  async refresh(conn: SocialConnection): Promise<OAuthResult> {
    if (!conn.refreshToken) throw new Error('Jeton Pinterest expiré : reconnectez le compte.');
    const t = await this.token({ grant_type: 'refresh_token', refresh_token: conn.refreshToken });
    return {
      accessToken: t.access_token!,
      refreshToken: t.refresh_token ?? conn.refreshToken,
      expiresAt: t.expires_in ? new Date(Date.now() + t.expires_in * 1000) : undefined,
      accountName: conn.accountName ?? 'Compte Pinterest',
      externalId: conn.externalId ?? undefined,
      scope: t.scope ?? conn.scope ?? SCOPES,
    };
  }

  async publish(conn: SocialConnection, input: PublishInput): Promise<PublishResult> {
    try {
      if (!conn.accessToken) throw new Error('Connexion Pinterest incomplète.');
      if (!input.imageUrl) {
        throw new Error(
          input.videoUrl
            ? 'Pinterest publie des images : ajoutez une image, ou retirez Pinterest de la sélection.'
            : 'Pinterest exige une image.',
        );
      }

      // Le tableau peut manquer si le compte n'en avait aucun à la connexion.
      const boardId = conn.externalId ?? (await this.firstBoardId(conn.accessToken));
      if (!boardId) {
        throw new Error('Aucun tableau Pinterest : créez-en un sur votre compte, puis reconnectez-le.');
      }

      const res = await fetch(`${API}/pins`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${conn.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          board_id: boardId,
          // Pinterest impose un titre court ; la légende complète va en description.
          title: input.caption.split('\n')[0]?.trim().slice(0, 100) || 'Nouvelle épingle',
          description: input.caption.slice(0, 800),
          media_source: { source_type: 'image_url', url: input.imageUrl },
        }),
      });
      const created = (await res.json()) as { id?: string; message?: string };
      if (!created.id) throw new Error(created.message ?? `Épingle refusée (HTTP ${res.status}).`);

      return { ok: true, externalId: created.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Pinterest — publication échouée : ${message}`);
      return { ok: false, error: message };
    }
  }

  /** Statistiques d'une épingle (impressions, enregistrements, clics). */
  async fetchInsights(conn: SocialConnection, externalId: string): Promise<InsightResult> {
    if (!conn.accessToken) throw new Error('Connexion Pinterest incomplète.');
    const res = await fetch(
      `${API}/pins/${encodeURIComponent(externalId)}/analytics?metric_types=IMPRESSION,SAVE,PIN_CLICK`,
      { headers: { Authorization: `Bearer ${conn.accessToken}` } },
    );
    const body = (await res.json()) as {
      all?: { summary_metrics?: Record<string, number> };
      message?: string;
    };
    if (!body.all) throw new Error(body.message ?? 'Statistiques Pinterest indisponibles.');

    const m = body.all.summary_metrics ?? {};
    return {
      views: m.IMPRESSION ?? 0,
      // Un « enregistrement » Pinterest est l'équivalent le plus proche d'un partage.
      shares: m.SAVE ?? 0,
      partial: 'J’aime et commentaires non fournis par l’API Pinterest',
    };
  }
}
