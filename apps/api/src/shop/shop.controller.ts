import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  UserRole,
  createShopSchema,
  updateShopSchema,
  type CreateShopInput,
  type UpdateShopInput,
} from '@odalyan/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ShopService } from './shop.service';

@Controller('shops')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  /** Vitrine publique d'une marque. */
  @Get('public/:slug')
  getPublic(@Param('slug') slug: string) {
    return this.shopService.getPublicShop(slug);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMine(@CurrentUser('id') userId: string) {
    return this.shopService.getMyShop(userId);
  }

  @Get('me/customers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  customers(@CurrentUser('id') userId: string) {
    return this.shopService.listCustomers(userId);
  }

  @Get('me/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  stats(@CurrentUser('id') userId: string) {
    return this.shopService.getStats(userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  create(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(createShopSchema)) input: CreateShopInput,
  ) {
    return this.shopService.createShop(userId, input);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  update(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(updateShopSchema)) input: UpdateShopInput,
  ) {
    return this.shopService.updateShop(userId, input);
  }
}
