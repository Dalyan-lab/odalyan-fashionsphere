import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole, checkoutSchema, type CheckoutInput } from '@odalyan/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ShopService } from '../shop/shop.service';
import { OrderService } from './order.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly shopService: ShopService,
  ) {}

  @Post('checkout')
  checkout(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(checkoutSchema)) input: CheckoutInput,
  ) {
    return this.orderService.checkout(userId, input);
  }

  @Get('mine')
  listMine(@CurrentUser('id') userId: string) {
    return this.orderService.listMine(userId);
  }

  @Get('shop')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  async listForShop(@CurrentUser('id') userId: string) {
    const shop = await this.shopService.requireOwnedShop(userId);
    return this.orderService.listForShop(shop.id);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  async updateStatus(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body('status') status: 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED',
  ) {
    const shop = await this.shopService.requireOwnedShop(userId);
    return this.orderService.updateStatus(shop.id, id, status);
  }
}
