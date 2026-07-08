import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { FlutterwaveProvider } from './providers/flutterwave.provider';
import { CinetpayProvider } from './providers/cinetpay.provider';
import { PaystackProvider } from './providers/paystack.provider';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService, FlutterwaveProvider, CinetpayProvider, PaystackProvider],
  exports: [PaymentService],
})
export class PaymentModule {}
