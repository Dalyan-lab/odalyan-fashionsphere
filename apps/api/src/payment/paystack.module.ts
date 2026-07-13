import { Global, Module } from '@nestjs/common';
import { PaystackProvider } from './providers/paystack.provider';

/**
 * Fournit PaystackProvider globalement pour éviter tout cycle de modules
 * (utilisé par PaymentService pour les commandes et par CreditsService pour les recharges).
 */
@Global()
@Module({
  providers: [PaystackProvider],
  exports: [PaystackProvider],
})
export class PaystackModule {}
