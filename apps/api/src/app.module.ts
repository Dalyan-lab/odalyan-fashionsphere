import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ShopModule } from './shop/shop.module';
import { ProductModule } from './product/product.module';
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';
import { AiModule } from './ai/ai.module';
import { SocialModule } from './social/social.module';
import { AdminModule } from './admin/admin.module';
import { CreditsModule } from './credits/credits.module';
import { UploadModule } from './upload/upload.module';
import { MailModule } from './mail/mail.module';
import { StorageModule } from './storage/storage.module';
import { ViralAmazoneModule } from './viral-amazone/viral-amazone.module';
import { CouponsModule } from './coupon/coupons.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    MailModule,
    StorageModule,
    AuthModule,
    ShopModule,
    ProductModule,
    OrderModule,
    PaymentModule,
    AiModule,
    SocialModule,
    AdminModule,
    CreditsModule,
    UploadModule,
    ViralAmazoneModule,
    CouponsModule,
    SubscriptionModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
