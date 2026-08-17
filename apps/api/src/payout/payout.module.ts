import { Global, Module } from '@nestjs/common';
import { ShopModule } from '../shop/shop.module';
import { PayoutController } from './payout.controller';
import { PayoutService } from './payout.service';

/**
 * Global : PaymentModule doit figer la répartition à l'encaissement et
 * AdminModule doit piloter les versements. Un module global évite un aller-retour
 * d'imports entre paiement, commandes et administration.
 */
@Global()
@Module({
  imports: [ShopModule],
  controllers: [PayoutController],
  providers: [PayoutService],
  exports: [PayoutService],
})
export class PayoutModule {}
