import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { createReviewSchema, type CreateReviewInput } from '@odalyan/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReviewService } from './review.service';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  /** Liste publique des avis d'un produit + moyenne. */
  @Get('product/:productId')
  list(@Param('productId') productId: string) {
    return this.reviewService.listForProduct(productId);
  }

  /** Laisser (ou modifier) un avis — utilisateur connecté. */
  @Post('product/:productId')
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
    @Body(new ZodValidationPipe(createReviewSchema)) input: CreateReviewInput,
  ) {
    return this.reviewService.upsert(userId, productId, input);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.reviewService.remove(userId, id);
  }
}
