import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  AMAZON_MARKETPLACES,
  UserRole,
  generateViralScriptSchema,
  listTrendsQuerySchema,
  type GenerateViralScriptInput,
  type ListTrendsQuery,
} from '@odalyan/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ShopService } from '../shop/shop.service';
import { TrendsService } from './trends.service';
import { ScriptGeneratorService } from './script-generator.service';
import { GamificationService } from './gamification.service';
import { PaapiProvider } from './providers/paapi.provider';
import { KeepaProvider } from './providers/keepa.provider';

@Controller('viral-amazone')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SELLER, UserRole.ADMIN)
export class ViralAmazoneController {
  constructor(
    private readonly trends: TrendsService,
    private readonly scripts: ScriptGeneratorService,
    private readonly gamification: GamificationService,
    private readonly shopService: ShopService,
    private readonly paapi: PaapiProvider,
    private readonly keepa: KeepaProvider,
  ) {}

  /** Indique si les sources de données réelles (PA-API/Keepa) sont configurées. */
  @Get('status')
  status() {
    const paapiMarketplaces = AMAZON_MARKETPLACES.filter((m) => this.paapi.enabledFor(m.domain)).map((m) => m.code);
    return { keepa: this.keepa.enabled, paapiMarketplaces, tracker: this.trends.enabled };
  }

  @Get('trends')
  listTrends(@Query(new ZodValidationPipe(listTrendsQuerySchema)) query: ListTrendsQuery) {
    return this.trends.listTrends(query);
  }

  /** Ajoute manuellement un ASIN au tracker, avec métadonnées optionnelles (curation admin). */
  @Post('trends/track')
  @Roles(UserRole.ADMIN)
  track(
    @Body()
    body: {
      asin: string;
      marketplace: string;
      title?: string;
      imageUrl?: string;
      category?: string;
      price?: number;
      currency?: string;
    },
  ) {
    return this.trends.trackAsin(body.asin, body.marketplace, body);
  }

  /** Retire un produit du tracker (curation admin). */
  @Delete('trends/:id')
  @Roles(UserRole.ADMIN)
  untrack(@Param('id') id: string) {
    return this.trends.untrackProduct(id);
  }

  @Post('scripts/generate')
  generateScript(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(generateViralScriptSchema)) input: GenerateViralScriptInput,
  ) {
    return this.scripts.generate(userId, input);
  }

  @Get('scripts')
  listScripts(@CurrentUser('id') userId: string) {
    return this.scripts.list(userId);
  }

  /** Progression du système d'encouragement : niveau, série, clics, historique de récompenses. */
  @Get('progress')
  async progress(@CurrentUser('id') userId: string) {
    const shop = await this.shopService.requireOwnedShop(userId);
    return this.gamification.getProgress(shop.id);
  }

  /** Classement des vendeurs les plus actifs de la semaine en cours (clics). */
  @Get('leaderboard')
  async leaderboard(@CurrentUser('id') userId: string) {
    const shop = await this.shopService.requireOwnedShop(userId).catch(() => null);
    return this.gamification.getLeaderboard(shop?.id ?? null);
  }
}
