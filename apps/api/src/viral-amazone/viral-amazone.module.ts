import { Module } from '@nestjs/common';
import { ShopModule } from '../shop/shop.module';
import { AiModule } from '../ai/ai.module';
import { ViralAmazoneController } from './viral-amazone.controller';
import { TrendsService } from './trends.service';
import { ScriptGeneratorService } from './script-generator.service';
import { PaapiProvider } from './providers/paapi.provider';
import { KeepaProvider } from './providers/keepa.provider';

@Module({
  imports: [ShopModule, AiModule],
  controllers: [ViralAmazoneController],
  providers: [TrendsService, ScriptGeneratorService, PaapiProvider, KeepaProvider],
})
export class ViralAmazoneModule {}
