import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
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
import { AiService } from './ai.service';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SELLER, UserRole.ADMIN)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('status')
  status() {
    return this.aiService.status();
  }

  @Post('mannequin')
  generateMannequin(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(generateMannequinSchema)) input: GenerateMannequinInput,
  ) {
    return this.aiService.generateMannequin(userId, input);
  }

  @Post('avatar')
  generateAvatar(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(generateAvatarSchema)) input: GenerateAvatarInput,
  ) {
    return this.aiService.generateAvatar(userId, input);
  }

  @Post('tryon')
  generateTryOn(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(generateTryOnSchema)) input: GenerateTryOnInput,
  ) {
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
  generateVideo(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(generateVideoSchema)) input: GenerateVideoInput,
  ) {
    return this.aiService.generateVideo(userId, input);
  }

  @Get('video/:id')
  getVideoStatus(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.aiService.getVideoStatus(userId, id);
  }

  @Post('campaign')
  generateCampaign(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(generateCampaignSchema)) input: GenerateCampaignInput,
  ) {
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
