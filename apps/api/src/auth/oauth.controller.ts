import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth/oauth')
export class OAuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * URL publique de l'API. Priorité à API_PUBLIC_URL ; sinon déduite des en-têtes
   * de la requête (proxy Railway) — évite un redirect_uri en localhost qui casserait
   * l'OAuth. La valeur doit être IDENTIQUE dans la demande d'auth et l'échange de jeton.
   */
  private apiBase(req: Request): string {
    if (process.env.API_PUBLIC_URL) return process.env.API_PUBLIC_URL.replace(/\/$/, '');
    const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol || 'https';
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
    return `${proto}://${host}`;
  }
  private get webOrigin() {
    return process.env.WEB_ORIGIN?.split(',')[0] ?? 'http://localhost:3000';
  }

  @Get('providers')
  providers() {
    return this.authService.oauthEnabled();
  }

  // ---------- Google ----------
  @Get('google')
  google(@Req() req: Request, @Res() res: Response) {
    if (!this.authService.oauthEnabled().google) return res.redirect(`${this.webOrigin}/login?error=oauth_disabled`);
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: `${this.apiBase(req)}/api/auth/oauth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account',
    });
    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  }

  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Req() req: Request, @Res() res: Response) {
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: `${this.apiBase(req)}/api/auth/oauth/google/callback`,
          grant_type: 'authorization_code',
        }),
      });
      const token = (await tokenRes.json()) as { access_token?: string };
      if (!token.access_token) throw new Error('no_token');

      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      const p = (await profileRes.json()) as {
        id: string;
        email: string;
        given_name?: string;
        family_name?: string;
        picture?: string;
      };

      const auth = await this.authService.oauthLogin({
        provider: 'google',
        providerId: p.id,
        email: p.email,
        firstName: p.given_name ?? '',
        lastName: p.family_name ?? '',
        avatarUrl: p.picture,
      });
      return this.redirectWithTokens(res, auth.tokens.accessToken, auth.tokens.refreshToken);
    } catch {
      return res.redirect(`${this.webOrigin}/login?error=oauth_failed`);
    }
  }

  // ---------- GitHub ----------
  @Get('github')
  github(@Req() req: Request, @Res() res: Response) {
    if (!this.authService.oauthEnabled().github) return res.redirect(`${this.webOrigin}/login?error=oauth_disabled`);
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID!,
      redirect_uri: `${this.apiBase(req)}/api/auth/oauth/github/callback`,
      scope: 'read:user user:email',
    });
    return res.redirect(`https://github.com/login/oauth/authorize?${params}`);
  }

  @Get('github/callback')
  async githubCallback(@Query('code') code: string, @Req() req: Request, @Res() res: Response) {
    try {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          code,
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          redirect_uri: `${this.apiBase(req)}/api/auth/oauth/github/callback`,
        }),
      });
      const token = (await tokenRes.json()) as { access_token?: string };
      if (!token.access_token) throw new Error('no_token');

      const headers = { Authorization: `Bearer ${token.access_token}`, 'User-Agent': 'Odalyan' };
      const u = (await (await fetch('https://api.github.com/user', { headers })).json()) as {
        id: number;
        name?: string;
        login: string;
        email?: string;
        avatar_url?: string;
      };
      let email = u.email;
      if (!email) {
        const emails = (await (await fetch('https://api.github.com/user/emails', { headers })).json()) as {
          email: string;
          primary: boolean;
        }[];
        email = emails.find((e) => e.primary)?.email ?? emails[0]?.email;
      }
      if (!email) throw new Error('no_email');

      const [firstName, ...rest] = (u.name ?? u.login).split(' ');
      const auth = await this.authService.oauthLogin({
        provider: 'github',
        providerId: String(u.id),
        email,
        firstName: firstName ?? u.login,
        lastName: rest.join(' '),
        avatarUrl: u.avatar_url,
      });
      return this.redirectWithTokens(res, auth.tokens.accessToken, auth.tokens.refreshToken);
    } catch {
      return res.redirect(`${this.webOrigin}/login?error=oauth_failed`);
    }
  }

  /** Renvoie vers le front avec les jetons dans le fragment (non journalisé). */
  private redirectWithTokens(res: Response, accessToken: string, refreshToken: string) {
    const hash = new URLSearchParams({ at: accessToken, rt: refreshToken }).toString();
    return res.redirect(`${this.webOrigin}/auth/callback#${hash}`);
  }
}
