import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole, createCouponSchema, type CreateCouponInput } from '@odalyan/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CouponsService } from './coupons.service';

/** Gestion des codes promo — réservée aux administrateurs de la plateforme. */
@Controller('admin/coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  list() {
    return this.coupons.list();
  }

  @Post()
  create(@Body(new ZodValidationPipe(createCouponSchema)) input: CreateCouponInput) {
    return this.coupons.create(input);
  }

  @Patch(':id/active')
  setActive(@Param('id') id: string, @Body('active') active: boolean) {
    return this.coupons.setActive(id, active);
  }
}
