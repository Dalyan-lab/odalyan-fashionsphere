import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { type CheckoutInput, type UpdateOrderStatusInput,
  PLATFORM_CURRENCY,
} from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from '../payment/payment.service';
import { MailService } from '../mail/mail.service';
import { ShippingService } from './shipping.service';
import { appUrl } from '../common/app-url';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
    private readonly mail: MailService,
    private readonly shipping: ShippingService,
  ) {}

  /**
   * Transforme un panier en commandes : une par boutique, un seul paiement.
   *
   * Le client paie une fois, mais chaque vendeur reçoit sa propre commande —
   * il l'expédie, la suit et s'en fait reverser indépendamment des autres.
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

    // Un panier mêlant plusieurs devises ne peut pas donner un montant unique
    // à encaisser. Le cas n'existe pas aujourd'hui, mais le laisser passer
    // silencieusement produirait un total faux.
    const currencies = new Set(products.map((p) => p.currency));
    if (currencies.size > 1) {
      throw new BadRequestException(
        'Le panier mélange plusieurs devises. Commandez séparément les articles concernés.',
      );
    }
    const currency = products[0]!.currency;

    interface Line {
      productId: string;
      variantId?: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      productName: string;
    }

    // Regroupement par boutique : chaque vendeur aura sa commande.
    const byShop = new Map<string, Line[]>();
    let grandTotal = new Prisma.Decimal(0);

    for (const item of input.items) {
      const product = products.find((p) => p.id === item.productId)!;
      let unitPrice = product.price;
      let variantId: string | undefined;

      if (item.variantId) {
        const variant = product.variants.find((v) => v.id === item.variantId);
        if (!variant) throw new BadRequestException(`Variante invalide pour ${product.name}`);
        if (variant.stock < item.quantity) {
          throw new BadRequestException(
            `Stock insuffisant pour ${product.name} (${variant.size}/${variant.color})`,
          );
        }
        unitPrice = variant.priceOverride ?? product.price;
        variantId = variant.id;
      }

      grandTotal = grandTotal.add(unitPrice.mul(item.quantity));
      const lines = byShop.get(product.shopId) ?? [];
      lines.push({
        productId: product.id,
        variantId,
        quantity: item.quantity,
        unitPrice,
        productName: product.name,
      });
      byShop.set(product.shopId, lines);
    }

    // Frais de livraison, résolus par boutique avant l'écriture : la
    // transaction doit rester courte, et ces lectures n'ont pas à s'y trouver.
    const dest = { country: input.shippingAddress.country, city: input.shippingAddress.city };
    const shipping = new Map<string, Prisma.Decimal>();
    for (const [shopId, lines] of byShop) {
      const subtotal = lines.reduce(
        (sum, l) => sum.add(l.unitPrice.mul(l.quantity)),
        new Prisma.Decimal(0),
      );
      const fee = await this.shipping.feeFor(shopId, subtotal, dest);
      shipping.set(shopId, fee);
      grandTotal = grandTotal.add(fee);
    }

    // Groupe, commandes et décrément de stock dans une seule transaction :
    // une commande créée sans son groupe, ou du stock décrémenté sans commande,
    // laisserait la base dans un état impossible à rattraper.
    const group = await this.prisma.$transaction(async (tx) => {
      const created = await tx.orderGroup.create({
        data: {
          reference: this.generateReference('ODLG'),
          customerId: userId,
          totalAmount: grandTotal,
          currency,
        },
      });

      for (const [shopId, lines] of byShop) {
        const subtotal = lines.reduce(
          (sum, l) => sum.add(l.unitPrice.mul(l.quantity)),
          new Prisma.Decimal(0),
        );
        const fee = shipping.get(shopId) ?? new Prisma.Decimal(0);
        await tx.order.create({
          data: {
            orderNumber: this.generateReference('ODL'),
            customerId: userId,
            shopId,
            groupId: created.id,
            totalAmount: subtotal.add(fee),
            shippingAmount: fee,
            currency,
            shippingAddress: input.shippingAddress as unknown as Prisma.InputJsonValue,
            items: { create: lines },
          },
        });
      }

      for (const line of [...byShop.values()].flat()) {
        if (!line.variantId) continue;
        await tx.productVariant.update({
          where: { id: line.variantId },
          data: { stock: { decrement: line.quantity } },
        });
      }

      return created;
    });

    const orders = await this.prisma.order.findMany({
      where: { groupId: group.id },
      include: { items: true, shop: { select: { name: true, slug: true } } },
    });

    const payment = await this.paymentService.createPaymentForGroup(group.id, grandTotal, currency);

    // `order` est conservé pour les appelants existants : le panier attend
    // encore un objet commande unique.
    return { group, orders, order: orders[0], payment };
  }

  /**
   * Estime le panier sans rien créer : sous-total, livraison par boutique, total.
   *
   * Indispensable pour annoncer les frais avant le paiement. Les découvrir sur
   * la page du prestataire de paiement est la première cause d'abandon de panier.
   */
  async quote(input: CheckoutInput) {
    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, status: 'ACTIVE' },
      include: { variants: true, shop: { select: { id: true, name: true } } },
    });
    if (products.length === 0) {
      return { currency: PLATFORM_CURRENCY, subtotal: 0, shipping: 0, total: 0, shops: [] };
    }

    const dest = { country: input.shippingAddress.country, city: input.shippingAddress.city };
    const perShop = new Map<string, { name: string; subtotal: Prisma.Decimal }>();

    for (const item of input.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;
      const variant = item.variantId
        ? product.variants.find((v) => v.id === item.variantId)
        : undefined;
      const unitPrice = variant?.priceOverride ?? product.price;
      const entry = perShop.get(product.shopId) ?? {
        name: product.shop.name,
        subtotal: new Prisma.Decimal(0),
      };
      entry.subtotal = entry.subtotal.add(unitPrice.mul(item.quantity));
      perShop.set(product.shopId, entry);
    }

    const shops = [];
    let subtotal = new Prisma.Decimal(0);
    let shipping = new Prisma.Decimal(0);
    for (const [shopId, entry] of perShop) {
      const fee = await this.shipping.feeFor(shopId, entry.subtotal, dest);
      subtotal = subtotal.add(entry.subtotal);
      shipping = shipping.add(fee);
      shops.push({
        shopId,
        shopName: entry.name,
        subtotal: Number(entry.subtotal),
        shipping: Number(fee),
      });
    }

    return {
      currency: products[0]!.currency,
      subtotal: Number(subtotal),
      shipping: Number(shipping),
      total: Number(subtotal.add(shipping)),
      shops,
    };
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

  /** Référence lisible et datée, pour les commandes comme pour les paniers. */
  private generateReference(prefix: string): string {
    const date = new Date();
    const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    return `${prefix}-${ymd}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }
}
