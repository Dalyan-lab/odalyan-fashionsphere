import { Module } from '@nestjs/common';
import { ShopModule } from '../shop/shop.module';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

@Module({
  imports: [ShopModule],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
