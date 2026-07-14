import { Module } from '@nestjs/common';
import { ShopModule } from '../shop/shop.module';
import { AiModule } from '../ai/ai.module';
import { ViralAmazoneController } from './viral-amazone.controller';
import { GoController } from './go.controller';
import { TrendsService } from './trends.service';
import { ScriptGeneratorService } from './script-generator.service';
import { GamificationService } from './gamification.service';
import { PaapiProvider } from './providers/paapi.provider';
import { KeepaProvider } from './providers/keepa.provider';

@Module({
  imports: [ShopModule, AiModule],
  controllers: [ViralAmazoneController, GoController],
  providers: [TrendsService, ScriptGeneratorService, GamificationService, PaapiProvider, KeepaProvider],
})
export class ViralAmazoneModule {}
