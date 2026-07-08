import { Body, Controller, Get, Headers, HttpCode, Post, RawBodyRequest, Req } from '@nestjs/common';
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

  /** Vérifie le paiement après retour de Flutterwave (page /payment/callback). */
  @Post('flutterwave/verify')
  verifyFlutterwave(@Body('transactionId') transactionId: string) {
    return this.paymentService.verifyFlutterwave(transactionId);
  }

  /** Vérifie le paiement après retour de Paystack (page /payment/callback). */
  @Post('paystack/verify')
  verifyPaystack(@Body('reference') reference: string) {
    return this.paymentService.verifyPaystack(reference);
  }

  /** Vérifie le paiement après retour de CinetPay (page /payment/callback). */
  @Post('cinetpay/verify')
  verifyCinetpay(@Body('transactionId') transactionId: string) {
    return this.paymentService.verifyCinetpay(transactionId);
  }

  /** Notification serveur-à-serveur de CinetPay (cpm_trans_id). */
  @Post('cinetpay/notify')
  @HttpCode(200)
  cinetpayNotify(@Body() body: { cpm_trans_id?: string }) {
    if (body?.cpm_trans_id) return this.paymentService.verifyCinetpay(body.cpm_trans_id);
    return { received: true };
  }
}
