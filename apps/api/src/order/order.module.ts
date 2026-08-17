import { Module } from '@nestjs/common';
import { ShopModule } from '../shop/shop.module';
import { PaymentModule } from '../payment/payment.module';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';

@Module({
  imports: [ShopModule, PaymentModule],
  controllers: [OrderController, ShippingController],
  providers: [OrderService, ShippingService],
  exports: [OrderService, ShippingService],
})
export class OrderModule {}
