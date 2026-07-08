import { Module } from '@nestjs/common';
import { ShopModule } from '../shop/shop.module';
import { PaymentModule } from '../payment/payment.module';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [ShopModule, PaymentModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
