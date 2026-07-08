import { Module } from '@nestjs/common';
import { ShopModule } from '../shop/shop.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ImageProvider } from './providers/image.provider';
import { TextProvider } from './providers/text.provider';
import { HeyGenProvider } from './providers/video/heygen.provider';
import { RunwayProvider } from './providers/video/runway.provider';
import { KlingProvider } from './providers/video/kling.provider';
import { VideoRegistry } from './providers/video/video.registry';

@Module({
  imports: [ShopModule],
  controllers: [AiController],
  providers: [
    AiService,
    ImageProvider,
    TextProvider,
    HeyGenProvider,
    RunwayProvider,
    KlingProvider,
    VideoRegistry,
  ],
  exports: [AiService],
})
export class AiModule {}
