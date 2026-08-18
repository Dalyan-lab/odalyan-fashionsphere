import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@odalyan/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ShopService } from '../shop/shop.service';
import { RefundService } from './refund.service';

@Controller('refunds')
@UseGuards(JwtAuthGuard)
export class RefundController {
  constructor(
    private readonly refunds: RefundService,
    private readonly shopService: ShopService,
  ) {}

  /** Demandes du client sur ses propres commandes. */
  @Get('mine')
  mine(@CurrentUser('id') userId: string) {
    return this.refunds.listForCustomer(userId);
  }

  /** Le client demande le remboursement d'une commande. */
  @Post()
  request(
    @CurrentUser('id') userId: string,
    @Body('orderId') orderId: string,
    @Body('reason') reason: string,
  ) {
    return this.refunds.request(userId, orderId, reason ?? '');
  }

  /** Demandes reçues par la boutique du vendeur. */
  @Get('shop')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  async forShop(@CurrentUser('id') userId: string) {
    const shop = await this.shopService.requireOwnedShop(userId);
    return this.refunds.listForShop(shop.id);
  }

  /** Le vendeur accorde ou refuse. */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  async decide(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body('approve') approve: boolean,
    @Body('note') note?: string,
  ) {
    const shop = await this.shopService.requireOwnedShop(userId);
    return this.refunds.decide(shop.id, id, Boolean(approve), note);
  }
}
