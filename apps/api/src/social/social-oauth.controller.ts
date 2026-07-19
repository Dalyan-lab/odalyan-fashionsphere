import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SocialService } from './social.service';
import { socialRedirectUri } from './social-redirect';

/**
 * Retour OAuth des réseaux sociaux — route PUBLIQUE (le réseau appelle sans session).
 * L'identité de la boutique est portée par le `state` signé.
 */
@Controller('social/oauth')
export class SocialOAuthController {
  constructor(private readonly socialService: SocialService) {}

  private get webOrigin() {
    return process.env.WEB_ORIGIN?.split(',')[0] ?? 'http://localhost:3000';
  }

  @Get('callback/:network')
  async callback(
    @Param('network') network: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const back = `${this.webOrigin}/dashboard/publications`;
    if (!code || !state) return res.redirect(`${back}?social=cancelled`);
    try {
      const r = await this.socialService.handleOAuthCallback(network, code, state, socialRedirectUri(req, network));
      return res.redirect(`${back}?social=connected&network=${encodeURIComponent(r.network)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connexion impossible';
      return res.redirect(`${back}?social=error&message=${encodeURIComponent(message.slice(0, 180))}`);
    }
  }
}
