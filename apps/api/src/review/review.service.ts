import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateReviewInput, ProductReviewsDto } from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  /** Avis d'un produit + moyenne (public). */
  async listForProduct(productId: string): Promise<ProductReviewsDto> {
    const reviews = await this.prisma.review.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const count = reviews.length;
    const average = count ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
    return {
      average,
      count,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        author: r.author,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  /** Crée ou met à jour l'avis de l'utilisateur pour ce produit (1 par personne). */
  async upsert(userId: string, productId: string, input: CreateReviewInput) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { shopId: true },
    });
    if (!product) throw new NotFoundException('Produit introuvable');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const author = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || 'Client';

    return this.prisma.review.upsert({
      where: { productId_userId: { productId, userId } },
      update: { rating: input.rating, comment: input.comment ?? null },
      create: {
        productId,
        userId,
        shopId: product.shopId,
        author,
        rating: input.rating,
        comment: input.comment ?? null,
      },
    });
  }

  async remove(userId: string, id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review || review.userId !== userId) throw new NotFoundException('Avis introuvable');
    await this.prisma.review.delete({ where: { id } });
    return { deleted: true };
  }
}
