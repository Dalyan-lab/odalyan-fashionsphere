import { Controller, Get, Logger, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from './gamification.service';

/**
 * Lien traçant public (hors préfixe /api, hors authentification) : le vendeur
 * colle CE lien dans sa bio/description au lieu du lien Amazon brut. Chaque
 * clic est compté (voir GamificationService.recordClick) puis redirigé vers
 * le vrai lien d'affiliation Amazon.
 */
@Controller('go')
export class GoController {
  private readonly logger = new Logger(GoController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  @Get(':scriptId')
  async redirect(@Param('scriptId') scriptId: string, @Req() req: Request, @Res() res: Response) {
    const script = await this.prisma.viralScript.findUnique({
      where: { id: scriptId },
      select: { affiliateUrl: true },
    });
    if (!script) {
      res.redirect(302, process.env.WEB_ORIGIN?.split(',')[0] ?? '/');
      return;
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    this.gamification
      .recordClick(scriptId, ip)
      .catch((err) => this.logger.error(`Clic non comptabilisé (${scriptId}): ${String(err)}`));

    res.redirect(302, script.affiliateUrl);
  }
}
