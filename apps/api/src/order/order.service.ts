import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { type CheckoutInput, type UpdateOrderStatusInput } from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from '../payment/payment.service';
import { MailService } from '../mail/mail.service';
import { appUrl } from '../common/app-url';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
    private readonly mail: MailService,
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

  /**
   * Commandes du client, avec de quoi suivre chacune.
   *
   * Le délai annoncé par la boutique est renvoyé avec la commande : c'est la
   * première question que se pose un acheteur, et la lui faire chercher sur la
   * vitrine du vendeur serait la meilleure façon de le pousser à réclamer.
   */
  async listMine(userId: string) {
    return this.prisma.order.findMany({
      where: { customerId: userId },
      include: {
        items: true,
        payment: true,
        shop: {
          select: {
            name: true,
            slug: true,
            logoUrl: true,
            deliveryDaysMin: true,
            deliveryDaysMax: true,
            deliveryNote: true,
          },
        },
      },
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

  /**
   * Le vendeur fait avancer la commande, et le client en est informé.
   *
   * Les dates d'expédition et de livraison sont posées ici plutôt que laissées
   * à la saisie : elles servent de référence au client comme au vendeur, et
   * une date déclarative serait invérifiable.
   */
  async updateStatus(shopId: string, orderId: string, input: UpdateOrderStatusInput) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: { select: { email: true } }, shop: { select: { name: true } } },
    });
    if (!order || order.shopId !== shopId) throw new NotFoundException('Commande introuvable');

    const { status, carrier, trackingNumber, trackingUrl } = input;
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        // Seuls les champs envoyés sont touchés : corriger un numéro de suivi
        // ne doit pas effacer le transporteur, et inversement.
        ...(carrier !== undefined ? { carrier: carrier || null } : {}),
        ...(trackingNumber !== undefined ? { trackingNumber: trackingNumber || null } : {}),
        ...(trackingUrl !== undefined ? { trackingUrl: trackingUrl || null } : {}),
        // Premier passage seulement : un aller-retour de statut ne doit pas
        // réécrire la date d'expédition d'origine.
        ...(status === 'SHIPPED' && !order.shippedAt ? { shippedAt: new Date() } : {}),
        ...(status === 'DELIVERED' && !order.deliveredAt ? { deliveredAt: new Date() } : {}),
      },
    });

    // Le vendeur marque d'abord la commande expédiée, puis saisit le suivi :
    // prévenir au seul changement de statut enverrait un email sans le numéro,
    // et plus rien ensuite. On prévient donc aussi à la première saisie du
    // suivi — mais pas aux corrections suivantes, qui n'apprendraient rien.
    const trackingJustAdded =
      !order.trackingNumber && !order.carrier && Boolean(updated.trackingNumber || updated.carrier);

    // L'email ne doit jamais faire échouer la mise à jour du statut.
    if (status !== order.status || trackingJustAdded) {
      void this.mail
        .sendOrderStatusUpdate(order.customer.email, {
          orderNumber: order.orderNumber,
          shopName: order.shop.name,
          status,
          carrier: updated.carrier,
          trackingNumber: updated.trackingNumber,
          trackingUrl: updated.trackingUrl,
          ordersUrl: `${appUrl()}/orders`,
        })
        .catch(() => undefined);
    }

    return updated;
  }

  private generateOrderNumber(): string {
    const date = new Date();
    const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    return `ODL-${ymd}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }
}
