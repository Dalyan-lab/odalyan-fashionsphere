import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@odalyan/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreditsService } from './credits.service';

@Controller('credits')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SELLER, UserRole.ADMIN)
export class CreditsController {
  constructor(private readonly credits: CreditsService) {}

  /** Solde de crédits IA (mensuel + achetés). */
  @Get('balance')
  balance(@CurrentUser('id') userId: string) {
    return this.credits.getBalance(userId);
  }

  /** Packs de recharge disponibles. */
  @Get('packs')
  packs() {
    return this.credits.listPacks();
  }

  /** Aperçu d'un code promo sur un pack (montant final avant paiement). */
  @Post('coupon/preview')
  previewCoupon(
    @CurrentUser('id') userId: string,
    @Body('code') code: string,
    @Body('packId') packId: string,
  ) {
    return this.credits.previewCoupon(userId, code, packId);
  }

  /** Démarre l'achat d'un pack : renvoie un lien de paiement Paystack (ou null si crédité en simulé). */
  @Post('purchase')
  purchase(
    @CurrentUser('id') userId: string,
    @Body('packId') packId: string,
    @Body('couponCode') couponCode?: string,
  ) {
    return this.credits.purchase(userId, packId, couponCode);
  }
}
