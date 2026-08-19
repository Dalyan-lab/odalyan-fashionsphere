import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  UserRole,
  createBannerSchema,
  updateBannerSchema,
  type CreateBannerInput,
  type UpdateBannerInput,
} from '@odalyan/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { BannerService } from './banner.service';

@Controller('banners')
export class BannerController {
  constructor(private readonly banners: BannerService) {}

  /**
   * Bandeau en cours. Volontairement **public et sans authentification** :
   * c'est la première chose que voit un visiteur, y compris non connecté.
   */
  @Get('current')
  current() {
    return this.banners.current();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  list() {
    return this.banners.list();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body(new ZodValidationPipe(createBannerSchema)) input: CreateBannerInput) {
    return this.banners.create(input);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBannerSchema)) input: UpdateBannerInput,
  ) {
    return this.banners.update(id, input);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.banners.remove(id);
  }
}
