import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  AI_CREDIT_COSTS,
  UserRole,
  generateAdCopySchema,
  generateAvatarSchema,
  generateCampaignSchema,
  generateMannequinSchema,
  generateTryOnSchema,
  generateVideoSchema,
  type GenerateAdCopyInput,
  type GenerateAvatarInput,
  type GenerateCampaignInput,
  type GenerateMannequinInput,
  type GenerateTryOnInput,
  type GenerateVideoInput,
} from '@odalyan/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreditsService } from '../credits/credits.service';
import { AiService } from './ai.service';

/** Vrais fournisseurs d'images branchés (sinon mode simulé → pas de débit de crédits). */
function realImageEnabled(): boolean {
  return Boolean(process.env.REPLICATE_API_TOKEN || process.env.OPENAI_API_KEY);
}
function realVideoEnabled(): boolean {
  return Boolean(
    process.env.REPLICATE_API_TOKEN ||
      process.env.RUNWAYML_API_SECRET ||
      process.env.KLING_API_KEY ||
      process.env.HEYGEN_API_KEY,
  );
}

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SELLER, UserRole.ADMIN)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly credits: CreditsService,
  ) {}

  @Get('status')
  status() {
    return this.aiService.status();
  }

  @Post('mannequin')
  async generateMannequin(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(generateMannequinSchema)) input: GenerateMannequinInput,
  ) {
    if (realImageEnabled()) await this.credits.consume(userId, AI_CREDIT_COSTS.image);
    return this.aiService.generateMannequin(userId, input);
  }

  @Post('avatar')
  async generateAvatar(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(generateAvatarSchema)) input: GenerateAvatarInput,
  ) {
    if (realImageEnabled()) await this.credits.consume(userId, AI_CREDIT_COSTS.image);
    return this.aiService.generateAvatar(userId, input);
  }

  @Post('tryon')
  async generateTryOn(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(generateTryOnSchema)) input: GenerateTryOnInput,
  ) {
    if (realImageEnabled()) await this.credits.consume(userId, AI_CREDIT_COSTS.tryon);
    return this.aiService.generateTryOn(userId, input);
  }

  @Post('ad-copy')
  generateAdCopy(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(generateAdCopySchema)) input: GenerateAdCopyInput,
  ) {
    return this.aiService.generateAdCopy(userId, input);
  }

  @Get('video/providers')
  listVideoProviders() {
    return this.aiService.listVideoProviders();
  }

  @Post('video')
  async generateVideo(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(generateVideoSchema)) input: GenerateVideoInput,
  ) {
    if (realVideoEnabled()) await this.credits.consume(userId, AI_CREDIT_COSTS.video);
    return this.aiService.generateVideo(userId, input);
  }

  @Get('video/:id')
  getVideoStatus(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.aiService.getVideoStatus(userId, id);
  }

  @Post('campaign')
  async generateCampaign(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(generateCampaignSchema)) input: GenerateCampaignInput,
  ) {
    if (realImageEnabled()) await this.credits.consume(userId, AI_CREDIT_COSTS.campaign);
    return this.aiService.generateCampaign(userId, input);
  }

  @Get('campaigns')
  listCampaigns(@CurrentUser('id') userId: string) {
    return this.aiService.listCampaigns(userId);
  }

  @Get('assets')
  listAssets(@CurrentUser('id') userId: string, @Query('type') type?: string) {
    return this.aiService.listAssets(userId, type);
  }
}
