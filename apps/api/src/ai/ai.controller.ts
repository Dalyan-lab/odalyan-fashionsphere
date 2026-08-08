import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  UserRole,
  addVoiceoverSchema,
  generateAdCopySchema,
  generateAvatarSchema,
  generateCampaignSchema,
  generateMannequinSchema,
  generateSocialCopySchema,
  generateSocialIdeasSchema,
  generateTryOnSchema,
  generateVideoSchema,
  type AddVoiceoverInput,
  type GenerateAdCopyInput,
  type GenerateAvatarInput,
  type GenerateCampaignInput,
  type GenerateMannequinInput,
  type GenerateSocialCopyInput,
  type GenerateSocialIdeasInput,
  type GenerateTryOnInput,
  type GenerateVideoInput,
} from '@odalyan/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AiService } from './ai.service';
import { ImageProvider } from './providers/image.provider';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SELLER, UserRole.ADMIN)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly imageProvider: ImageProvider,
  ) {}

  @Get('status')
  status() {
    return this.aiService.status();
  }

  /** Diagnostic Replicate (admin) : vérifie clé + facturation et renvoie la vraie réponse. */
  @Get('diag')
  @Roles(UserRole.ADMIN)
  diag() {
    return this.imageProvider.diagnose();
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

  /** Dernier essayage sauvegardé pour un produit (persistance de la vue). */
  @Get('tryon/last')
  getLastTryOn(@CurrentUser('id') userId: string, @Query('productId') productId: string) {
    return this.aiService.getLastTryOn(userId, productId);
  }

  @Post('ad-copy')
  generateAdCopy(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(generateAdCopySchema)) input: GenerateAdCopyInput,
  ) {
    return this.aiService.generateAdCopy(userId, input);
  }

  /** Pilotage social : un texte prêt à publier par réseau choisi. */
  @Post('social-copy')
  generateSocialCopy(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(generateSocialCopySchema)) input: GenerateSocialCopyInput,
  ) {
    return this.aiService.generateSocialCopy(userId, input);
  }

  /** Pilotage social : idées de sujets + hashtags pour la boutique. */
  @Post('social-ideas')
  generateSocialIdeas(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(generateSocialIdeasSchema)) input: GenerateSocialIdeasInput,
  ) {
    return this.aiService.generateSocialIdeas(userId, input);
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

  /** Liste des vidéos générées (persistance) — optionnellement filtrées par produit. */
  @Get('videos')
  listVideos(@CurrentUser('id') userId: string, @Query('productId') productId?: string) {
    return this.aiService.listVideos(userId, productId);
  }

  @Get('video/:id')
  getVideoStatus(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.aiService.getVideoStatus(userId, id);
  }

  /** Ajoute une voix off publicitaire (TTS + montage) sur une vidéo → nouvelle vidéo. */
  @Post('video/:id/voiceover')
  addVoiceover(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addVoiceoverSchema)) input: AddVoiceoverInput,
  ) {
    return this.aiService.addVoiceover(userId, id, input);
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

  /** Purge tous les contenus simulés (démo). Route statique AVANT :id. */
  @Delete('assets/simulated')
  deleteSimulated(@CurrentUser('id') userId: string) {
    return this.aiService.deleteSimulatedAssets(userId);
  }

  @Delete('assets/:id')
  deleteAsset(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.aiService.deleteAsset(userId, id);
  }
}
