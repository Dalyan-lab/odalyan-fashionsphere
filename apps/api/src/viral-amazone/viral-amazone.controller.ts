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
import { TrendsService } from './trends.service';
import { ScriptGeneratorService } from './script-generator.service';
import { PaapiProvider } from './providers/paapi.provider';
import { KeepaProvider } from './providers/keepa.provider';

@Controller('viral-amazone')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SELLER, UserRole.ADMIN)
export class ViralAmazoneController {
  constructor(
    private readonly trends: TrendsService,
    private readonly scripts: ScriptGeneratorService,
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

  /** Ajoute manuellement un ASIN au tracker (curation admin/vendeur). */
  @Post('trends/track')
  @Roles(UserRole.ADMIN)
  track(@Body('asin') asin: string, @Body('marketplace') marketplace: string) {
    return this.trends.trackAsin(asin, marketplace);
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
}
