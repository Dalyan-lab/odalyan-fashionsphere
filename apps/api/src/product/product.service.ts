import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  PLAN_PRODUCT_LIMITS,
  ProductCategory,
  SubscriptionPlan,
  type CreateProductInput,
  type UpdateProductInput,
} from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ShopService } from '../shop/shop.service';

export interface MarketplaceFilters {
  category?: ProductCategory;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shopService: ShopService,
  ) {}

  /** Listing public de la marketplace, avec filtres et pagination. */
  async marketplace(filters: MarketplaceFilters) {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(60, Math.max(1, filters.pageSize ?? 24));

    const where: Prisma.ProductWhereInput = {
      status: 'ACTIVE',
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.search
        ? { name: { contains: filters.search, mode: 'insensitive' } }
        : {}),
      ...(filters.minPrice || filters.maxPrice
        ? {
            price: {
              ...(filters.minPrice ? { gte: filters.minPrice } : {}),
              ...(filters.maxPrice ? { lte: filters.maxPrice } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { shop: { select: { name: true, slug: true, logoUrl: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: true, shop: { select: { name: true, slug: true, logoUrl: true } } },
    });
    if (!product) throw new NotFoundException('Produit introuvable');
    return product;
  }

  /** Produits de la boutique du vendeur connecté. */
  async listMine(userId: string) {
    const shop = await this.shopService.requireOwnedShop(userId);
    return this.prisma.product.findMany({
      where: { shopId: shop.id },
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, input: CreateProductInput) {
    const shop = await this.shopService.requireOwnedShop(userId);

    const limit = PLAN_PRODUCT_LIMITS[shop.subscription?.plan ?? SubscriptionPlan.STARTER];
    const count = await this.prisma.product.count({ where: { shopId: shop.id } });
    if (count >= limit) {
      throw new ForbiddenException(
        `Limite de produits atteinte pour votre abonnement (${limit}). Passez à un plan supérieur.`,
      );
    }

    const { variants, ...data } = input;
    return this.prisma.product.create({
      data: {
        ...data,
        shopId: shop.id,
        variants: variants?.length ? { create: variants } : undefined,
      },
      include: { variants: true },
    });
  }

  async update(userId: string, id: string, input: UpdateProductInput) {
    const product = await this.assertOwnership(userId, id);
    const { variants, ...data } = input;

    return this.prisma.product.update({
      where: { id: product.id },
      data: {
        ...data,
        ...(variants
          ? { variants: { deleteMany: {}, create: variants } }
          : {}),
      },
      include: { variants: true },
    });
  }

  async remove(userId: string, id: string) {
    const product = await this.assertOwnership(userId, id);
    await this.prisma.product.delete({ where: { id: product.id } });
    return { deleted: true };
  }

  private async assertOwnership(userId: string, productId: string) {
    const shop = await this.shopService.requireOwnedShop(userId);
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Produit introuvable');
    if (product.shopId !== shop.id) {
      throw new ForbiddenException("Ce produit n'appartient pas à votre boutique");
    }
    return product;
  }
}
