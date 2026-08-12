import { Module } from '@nestjs/common';
import { ShopModule } from '../shop/shop.module';
import { SocialController } from './social.controller';
import { SocialOAuthController } from './social-oauth.controller';
import { SocialService } from './social.service';
import { FacebookPublisher } from './publishers/meta.publisher';
import { InstagramPublisher } from './publishers/instagram.publisher';
import { TikTokPublisher } from './publishers/tiktok.publisher';
import { YouTubePublisher } from './publishers/youtube.publisher';
import { PinterestPublisher } from './publishers/pinterest.publisher';
import { PublisherRegistry } from './publishers/publisher.registry';

@Module({
  imports: [ShopModule],
  controllers: [SocialController, SocialOAuthController],
  providers: [
    SocialService,
    FacebookPublisher,
    InstagramPublisher,
    TikTokPublisher,
    YouTubePublisher,
    PinterestPublisher,
    PublisherRegistry,
  ],
})
export class SocialModule {}
