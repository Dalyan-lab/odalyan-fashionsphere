import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { UserRole, schedulePostSchema, type SchedulePostInput } from '@odalyan/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SocialService } from './social.service';
import { socialRedirectUri } from './social-redirect';

@Controller('social')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SELLER, UserRole.ADMIN)
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  /** État des réseaux : provider écrit ? app développeur configurée ? */
  @Get('networks')
  networks() {
    return this.socialService.listNetworks();
  }

  @Get('connections')
  connections(@CurrentUser('id') userId: string) {
    return this.socialService.listConnections(userId);
  }

  /** Renvoie l'URL d'autorisation OAuth (réel) ou effectue une connexion simulée. */
  @Post('connect/:network')
  connect(@CurrentUser('id') userId: string, @Param('network') network: string, @Req() req: Request) {
    return this.socialService.connect(userId, network, socialRedirectUri(req, network));
  }

  @Post('disconnect/:network')
  disconnect(@CurrentUser('id') userId: string, @Param('network') network: string) {
    return this.socialService.disconnect(userId, network);
  }

  @Post('schedule')
  schedule(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(schedulePostSchema)) input: SchedulePostInput,
  ) {
    return this.socialService.schedule(userId, input);
  }

  @Get('scheduled')
  scheduled(@CurrentUser('id') userId: string) {
    return this.socialService.listScheduled(userId);
  }

  @Post('scheduled/:id/cancel')
  cancel(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.socialService.cancel(userId, id);
  }

  @Delete('scheduled/:id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.socialService.remove(userId, id);
  }

  /** Déclenche manuellement le worker de publication (admin). */
  @Post('run-publisher')
  @Roles(UserRole.ADMIN)
  runPublisher() {
    return this.socialService.processAllDue();
  }
}
