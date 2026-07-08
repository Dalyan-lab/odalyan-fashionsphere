import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ShopModule } from './shop/shop.module';
import { ProductModule } from './product/product.module';
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';
import { AiModule } from './ai/ai.module';
import { SocialModule } from './social/social.module';
import { AdminModule } from './admin/admin.module';
import { UploadModule } from './upload/upload.module';
import { MailModule } from './mail/mail.module';
import { StorageModule } from './storage/storage.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    UploadModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
