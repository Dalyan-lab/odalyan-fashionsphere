import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserRole, payoutAccountSchema, type PayoutAccountInput } from '@odalyan/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ShopService } from '../shop/shop.service';
import { PrismaService } from '../prisma/prisma.service';
import { PayoutService } from './payout.service';

/** Revenus et versements, vus par le vendeur. */
@Controller('payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SELLER, UserRole.ADMIN)
export class PayoutController {
  constructor(
    private readonly payouts: PayoutService,
    private readonly shopService: ShopService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('balance')
  async balance(@CurrentUser('id') userId: string) {
    const shop = await this.shopService.requireOwnedShop(userId);
    return this.payouts.balance(shop.id);
  }

  @Get()
  async mine(@CurrentUser('id') userId: string) {
    const shop = await this.shopService.requireOwnedShop(userId);
    return this.payouts.listForShop(shop.id);
  }

  /** Coordonnées de reversement du vendeur. */
  @Get('account')
  async account(@CurrentUser('id') userId: string) {
    const shop = await this.shopService.requireOwnedShop(userId);
    return this.prisma.shop.findUnique({
      where: { id: shop.id },
      select: {
        payoutMethod: true,
        payoutOperator: true,
        payoutNumber: true,
        payoutHolderName: true,
      },
    });
  }

  @Patch('account')
  async updateAccount(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(payoutAccountSchema)) input: PayoutAccountInput,
  ) {
    const shop = await this.shopService.requireOwnedShop(userId);
    return this.prisma.shop.update({
      where: { id: shop.id },
      data: {
        payoutMethod: input.payoutMethod ?? null,
        // '' efface le champ : un numéro erroné doit pouvoir être retiré, pas
        // seulement remplacé.
        payoutOperator: input.payoutOperator || null,
        payoutNumber: input.payoutNumber || null,
        payoutHolderName: input.payoutHolderName || null,
      },
      select: {
        payoutMethod: true,
        payoutOperator: true,
        payoutNumber: true,
        payoutHolderName: true,
      },
    });
  }
}
