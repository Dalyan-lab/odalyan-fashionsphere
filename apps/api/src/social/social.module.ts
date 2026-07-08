import { Module } from '@nestjs/common';
import { ShopModule } from '../shop/shop.module';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';

@Module({
  imports: [ShopModule],
  controllers: [SocialController],
  providers: [SocialService],
})
export class SocialModule {}
