import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { type CheckoutInput } from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
  ) {}

  /**
   * Crée une commande à partir d'un panier.
   * Note MVP : les articles doivent appartenir à une même boutique.
   */
  async checkout(userId: string, input: CheckoutInput) {
    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, status: 'ACTIVE' },
      include: { variants: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('Un ou plusieurs produits sont introuvables ou indisponibles');
    }

    // Un produit affilié (lien Amazon) ne s'achète pas via le panier interne
    if (products.some((p) => p.affiliateUrl)) {
      throw new BadRequestException(
        'Un produit affilié ne peut pas être commandé ici — il s’achète directement sur Amazon.',
      );
    }

    const shopIds = new Set(products.map((p) => p.shopId));
    if (shopIds.size > 1) {
      throw new BadRequestException(
        'Le panier contient des produits de plusieurs boutiques. Commandez boutique par boutique pour le MVP.',
      );
    }
    const shopId = products[0]!.shopId;

    let total = new Prisma.Decimal(0);
    const orderItems = input.items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      let unitPrice = product.price;
      let variantId: string | undefined;

      if (item.variantId) {
        const variant = product.variants.find((v) => v.id === item.variantId);
        if (!variant) throw new BadRequestException(`Variante invalide pour ${product.name}`);
        if (variant.stock < item.quantity) {
          throw new BadRequestException(`Stock insuffisant pour ${product.name} (${variant.size}/${variant.color})`);
        }
        unitPrice = variant.priceOverride ?? product.price;
        variantId = variant.id;
      }

      total = total.add(unitPrice.mul(item.quantity));
      return {
        productId: product.id,
        variantId,
        quantity: item.quantity,
        unitPrice,
        productName: product.name,
      };
    });

    const order = await this.prisma.order.create({
      data: {
        orderNumber: this.generateOrderNumber(),
        customerId: userId,
        shopId,
        totalAmount: total,
        currency: products[0]!.currency,
        shippingAddress: input.shippingAddress as unknown as Prisma.InputJsonValue,
        items: { create: orderItems },
      },
      include: { items: true },
    });

    // Décrémente le stock des variantes commandées
    await this.prisma.$transaction(
      orderItems
        .filter((i) => i.variantId)
        .map((i) =>
          this.prisma.productVariant.update({
            where: { id: i.variantId! },
            data: { stock: { decrement: i.quantity } },
          }),
        ),
    );

    const payment = await this.paymentService.createPaymentForOrder(order.id, total, order.currency);

    return { order, payment };
  }

  async listMine(userId: string) {
    return this.prisma.order.findMany({
      where: { customerId: userId },
      include: { items: true, payment: true, shop: { select: { name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Commandes reçues par la boutique du vendeur. */
  async listForShop(shopId: string) {
    return this.prisma.order.findMany({
      where: { shopId },
      include: { items: true, payment: true, customer: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(shopId: string, orderId: string, status: 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED') {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.shopId !== shopId) throw new NotFoundException('Commande introuvable');
    return this.prisma.order.update({ where: { id: orderId }, data: { status } });
  }

  private generateOrderNumber(): string {
    const date = new Date();
    const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    return `ODL-${ymd}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }
}
