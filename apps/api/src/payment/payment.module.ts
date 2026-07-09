import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaystackProvider } from './providers/paystack.provider';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService, PaystackProvider],
  exports: [PaymentService],
})
export class PaymentModule {}
