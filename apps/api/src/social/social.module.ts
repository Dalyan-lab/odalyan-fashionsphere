import { Module } from '@nestjs/common';
import { ShopModule } from '../shop/shop.module';
import { SocialController } from './social.controller';
import { SocialOAuthController } from './social-oauth.controller';
import { SocialService } from './social.service';
import { FacebookPublisher, InstagramPublisher } from './publishers/meta.publisher';
import { TikTokPublisher } from './publishers/tiktok.publisher';
import { PublisherRegistry } from './publishers/publisher.registry';

@Module({
  imports: [ShopModule],
  controllers: [SocialController, SocialOAuthController],
  providers: [SocialService, FacebookPublisher, InstagramPublisher, TikTokPublisher, PublisherRegistry],
})
export class SocialModule {}
