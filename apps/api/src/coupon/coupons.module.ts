import { Global, Module } from '@nestjs/common';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';

/** Global : CouponsService est utilisé par CreditsService (et futurs flux de paiement). */
@Global()
@Module({
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
