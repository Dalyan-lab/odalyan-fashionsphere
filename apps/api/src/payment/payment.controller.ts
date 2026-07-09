import { Body, Controller, Get, Headers, Post, RawBodyRequest, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentService } from './payment.service';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('config')
  config() {
    return this.paymentService.config();
  }

  @Post('stripe/webhook')
  handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.paymentService.handleStripeWebhook(req.rawBody as Buffer, signature);
  }

  /** Vérifie le paiement après retour de Paystack (page /payment/callback). */
  @Post('paystack/verify')
  verifyPaystack(@Body('reference') reference: string) {
    return this.paymentService.verifyPaystack(reference);
  }
}
