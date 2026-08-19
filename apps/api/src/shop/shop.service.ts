import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import {
  SubscriptionPlan,
  type CreateShopInput,
  type ShippingSettingsInput,
  type UpdateShopInput,
} from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ShopService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fil d'activité récente de la boutique.
   *
   * Dérivé des enregistrements existants — commandes, remboursements,
   * versements, publications, avis — plutôt que d'une table d'événements
   * alimentée par les services. Une telle table finirait par diverger du réel
   * dès qu'un service oublierait d'y écrire, et resterait vide pour tout ce qui
   * s'est passé avant sa création. Ici le fil ne peut pas mentir : il n'existe
   * que si l'enregistrement existe.
   *
   * Les libellés ne sont **pas** composés ici. L'API renvoie le type et ses
   * données ; c'est le client qui rédige, dans la langue de l'utilisateur.
   */
  async recentActivity(userId: string, limit = 12) {
    const shop = await this.requireOwnedShop(userId);
    const where = { shopId: shop.id };

    // Trois requêtes distinctes sur les commandes, chacune triée sur SA date :
    // prendre les dernières commandes créées manquerait une vieille commande
    // livrée ce matin, qui est pourtant l'événement le plus frais.
    const [payees, expediees, livrees, demandes, tranches, verses, publiees, avis] =
      await Promise.all([
        this.prisma.order.findMany({
          where: { ...where, payment: { is: { paid: true } } },
          select: { orderNumber: true, totalAmount: true, currency: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
        this.prisma.order.findMany({
          where: { ...where, shippedAt: { not: null } },
          select: { orderNumber: true, currency: true, shippedAt: true },
          orderBy: { shippedAt: 'desc' },
          take: limit,
        }),
        this.prisma.order.findMany({
          where: { ...where, deliveredAt: { not: null } },
          select: { orderNumber: true, currency: true, deliveredAt: true },
          orderBy: { deliveredAt: 'desc' },
          take: limit,
        }),
        this.prisma.refund.findMany({
          where: { order: where },
          select: { amount: true, createdAt: true, order: { select: { orderNumber: true, currency: true } } },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
        this.prisma.refund.findMany({
          where: { order: where, decidedAt: { not: null } },
          select: {
            status: true,
            amount: true,
            decidedAt: true,
            order: { select: { orderNumber: true, currency: true } },
          },
          orderBy: { decidedAt: 'desc' },
          take: limit,
        }),
        this.prisma.payout.findMany({
          where: { ...where, paidAt: { not: null } },
          select: { reference: true, amount: true, currency: true, paidAt: true },
          orderBy: { paidAt: 'desc' },
          take: limit,
        }),
        this.prisma.scheduledPost.findMany({
          where: { ...where, publishedAt: { not: null } },
          select: { networks: true, publishedAt: true, status: true },
          orderBy: { publishedAt: 'desc' },
          take: limit,
        }),
        this.prisma.review.findMany({
          where,
          select: { rating: true, author: true, createdAt: true, product: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
      ]);

    const evenements: {
      type: string;
      at: Date;
      ref?: string;
      amount?: number;
      currency?: string;
      networks?: string[];
      rating?: number;
      label?: string;
      approved?: boolean;
    }[] = [
      ...payees.map((o) => ({
        type: 'ORDER_PAID',
        at: o.createdAt,
        ref: o.orderNumber,
        amount: Number(o.totalAmount),
        currency: o.currency,
      })),
      ...expediees.map((o) => ({
        type: 'ORDER_SHIPPED',
        at: o.shippedAt!,
        ref: o.orderNumber,
      })),
      ...livrees.map((o) => ({
        type: 'ORDER_DELIVERED',
        at: o.deliveredAt!,
        ref: o.orderNumber,
      })),
      ...demandes.map((r) => ({
        type: 'REFUND_REQUESTED',
        at: r.createdAt,
        ref: r.order.orderNumber,
        amount: Number(r.amount),
        currency: r.order.currency,
      })),
      ...tranches.map((r) => ({
        type: 'REFUND_DECIDED',
        at: r.decidedAt!,
        ref: r.order.orderNumber,
        amount: Number(r.amount),
        currency: r.order.currency,
        approved: r.status === 'APPROVED',
      })),
      ...verses.map((p) => ({
        type: 'PAYOUT_PAID',
        at: p.paidAt!,
        ref: p.reference,
        amount: Number(p.amount),
        currency: p.currency,
      })),
      ...publiees.map((p) => ({
        type: 'POST_PUBLISHED',
        at: p.publishedAt!,
        networks: p.networks,
      })),
      ...avis.map((a) => ({
        type: 'REVIEW_ADDED',
        at: a.createdAt,
        rating: a.rating,
        label: a.product.name,
      })),
    ];

    return evenements.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
  }

  /** Boutique du vendeur connecté (avec abonnement + chiffre d'affaires réel). */
  async getMyShop(userId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { ownerId: userId },
      include: { subscription: true, _count: { select: { products: true, orders: true } } },
    });
    if (!shop) return null;

    const revenue = await this.prisma.order.aggregate({
      where: { shopId: shop.id, status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
      _sum: { totalAmount: true },
    });

    return { ...shop, revenue: Number(revenue._sum.totalAmount ?? 0) };
  }

  /** Vitrine publique d'une marque par slug. */
  async getPublicShop(slug: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { slug },
      include: {
        products: {
          where: { status: 'ACTIVE' },
          include: { variants: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!shop) throw new NotFoundException('Boutique introuvable');
    return shop;
  }

  async createShop(userId: string, input: CreateShopInput) {
    const existing = await this.prisma.shop.findUnique({ where: { ownerId: userId } });
    if (existing) throw new ConflictException('Vous possédez déjà une boutique');

    const slugTaken = await this.prisma.shop.findUnique({ where: { slug: input.slug } });
    if (slugTaken) throw new ConflictException('Ce slug de boutique est déjà pris');

    return this.prisma.shop.create({
      data: {
        ...input,
        ownerId: userId,
        subscription: { create: { plan: SubscriptionPlan.STARTER } },
      },
      include: { subscription: true },
    });
  }

  async updateShop(userId: string, input: UpdateShopInput) {
    const shop = await this.prisma.shop.findUnique({ where: { ownerId: userId } });
    if (!shop) throw new NotFoundException("Vous n'avez pas encore de boutique");

    if (input.slug && input.slug !== shop.slug) {
      const slugTaken = await this.prisma.shop.findUnique({ where: { slug: input.slug } });
      if (slugTaken) throw new ConflictException('Ce slug de boutique est déjà pris');
    }

    return this.prisma.shop.update({ where: { id: shop.id }, data: input });
  }

  /** Statistiques de la boutique : revenus, top produits, conversion. */
  async getStats(userId: string) {
    const shop = await this.requireOwnedShop(userId);
    const paidStatuses: OrderStatus[] = [
      OrderStatus.PAID,
      OrderStatus.PROCESSING,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ];

    const [orders, productsCount, items] = await Promise.all([
      this.prisma.order.findMany({
        where: { shopId: shop.id },
        select: { status: true, totalAmount: true, customerId: true, createdAt: true },
      }),
      this.prisma.product.count({ where: { shopId: shop.id } }),
      this.prisma.orderItem.findMany({
        where: { order: { shopId: shop.id, status: { in: paidStatuses } } },
        select: { productName: true, quantity: true, unitPrice: true },
      }),
    ]);

    const paidOrders = orders.filter((o) => paidStatuses.includes(o.status));
    const revenue = paidOrders.reduce((s, o) => s + Number(o.totalAmount), 0);
    const customers = new Set(orders.map((o) => o.customerId)).size;
    const aov = paidOrders.length ? revenue / paidOrders.length : 0;
    const conversionRate = orders.length ? (paidOrders.length / orders.length) * 100 : 0;

    // Top produits (par chiffre d'affaires)
    const prodMap = new Map<string, { name: string; sold: number; revenue: number }>();
    for (const it of items) {
      const e = prodMap.get(it.productName) ?? { name: it.productName, sold: 0, revenue: 0 };
      e.sold += it.quantity;
      e.revenue += Number(it.unitPrice) * it.quantity;
      prodMap.set(it.productName, e);
    }
    const topProducts = [...prodMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // Revenus des 6 derniers mois
    const now = new Date();
    const months: { label: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('fr-FR', { month: 'short' });
      const rev = paidOrders
        .filter((o) => o.createdAt.getFullYear() === d.getFullYear() && o.createdAt.getMonth() === d.getMonth())
        .reduce((s, o) => s + Number(o.totalAmount), 0);
      months.push({ label, revenue: rev });
    }

    // Activité des 7 derniers jours, aujourd'hui compris.
    //
    // Calculée sur les commandes déjà chargées : la série mensuelle ci-dessus
    // fait de même, et une requête d'agrégation par jour coûterait un aller
    // supplémentaire pour un volume que l'on tient déjà en mémoire.
    //
    // Les jours sans vente sont **présents avec zéro**, jamais omis : une
    // courbe qui saute les jours creux resserre l'axe et fait passer une
    // semaine calme pour une semaine régulière.
    const JOUR = 24 * 60 * 60 * 1000;
    const aujourdhui = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dailyActivity: { date: string; revenue: number; orders: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const debut = new Date(aujourdhui.getTime() - i * JOUR);
      const fin = new Date(debut.getTime() + JOUR);
      const duJour = paidOrders.filter((o) => o.createdAt >= debut && o.createdAt < fin);
      dailyActivity.push({
        // Date seule, sans heure : c'est le client qui compose le libellé,
        // dans la langue de l'utilisateur.
        date: `${debut.getFullYear()}-${String(debut.getMonth() + 1).padStart(2, '0')}-${String(debut.getDate()).padStart(2, '0')}`,
        revenue: duJour.reduce((s, o) => s + Number(o.totalAmount), 0),
        orders: duJour.length,
      });
    }

    return {
      revenue,
      ordersCount: orders.length,
      paidOrdersCount: paidOrders.length,
      productsCount,
      customersCount: customers,
      aov,
      conversionRate,
      topProducts,
      monthlyRevenue: months,
      dailyActivity,
    };
  }

  /** Liste des clients de la boutique (agrégés depuis les commandes). */
  async listCustomers(userId: string) {
    const shop = await this.requireOwnedShop(userId);
    const orders = await this.prisma.order.findMany({
      where: { shopId: shop.id },
      include: { customer: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const paidStatuses = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
    const map = new Map<
      string,
      {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        ordersCount: number;
        totalSpent: number;
        lastOrderAt: string;
      }
    >();

    for (const o of orders) {
      const c = o.customer;
      const entry = map.get(c.id) ?? {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        ordersCount: 0,
        totalSpent: 0,
        lastOrderAt: o.createdAt.toISOString(),
      };
      entry.ordersCount += 1;
      if (paidStatuses.includes(o.status)) entry.totalSpent += Number(o.totalAmount);
      if (o.createdAt.toISOString() > entry.lastOrderAt) entry.lastOrderAt = o.createdAt.toISOString();
      map.set(c.id, entry);
    }

    return [...map.values()].sort((a, b) => b.totalSpent - a.totalSpent);
  }

  /** Récupère la boutique d'un vendeur ou lève une erreur (utilitaire interne). */
  /** Réglages de livraison de la boutique du vendeur. */
  async getShipping(userId: string) {
    const shop = await this.requireOwnedShop(userId);
    const full = await this.prisma.shop.findUnique({
      where: { id: shop.id },
      select: {
        shippingFee: true,
        freeShippingFrom: true,
        shippingRates: { orderBy: { position: 'asc' } },
      },
    });
    return {
      shippingFee: full?.shippingFee != null ? Number(full.shippingFee) : null,
      freeShippingFrom: full?.freeShippingFrom != null ? Number(full.freeShippingFrom) : null,
      rates: (full?.shippingRates ?? []).map((r) => ({
        name: r.name,
        cities: r.cities,
        countries: r.countries,
        fee: Number(r.fee),
      })),
    };
  }

  /**
   * Enregistre les réglages de livraison.
   *
   * Les zones sont remplacées en bloc, dans une transaction : un remplacement
   * partiel laisserait des tarifs fantômes qui s'appliqueraient aux clients.
   * `position` reprend l'ordre d'envoi, car la première zone qui correspond
   * l'emporte — c'est ce qui permet de placer « Abidjan » avant « Côte d'Ivoire ».
   */
  async updateShipping(userId: string, input: ShippingSettingsInput) {
    const shop = await this.requireOwnedShop(userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.shop.update({
        where: { id: shop.id },
        data: {
          ...(input.shippingFee !== undefined ? { shippingFee: input.shippingFee } : {}),
          ...(input.freeShippingFrom !== undefined
            ? { freeShippingFrom: input.freeShippingFrom }
            : {}),
        },
      });
      if (input.rates) {
        await tx.shippingRate.deleteMany({ where: { shopId: shop.id } });
        for (const [i, rate] of input.rates.entries()) {
          await tx.shippingRate.create({
            data: {
              shopId: shop.id,
              name: rate.name,
              cities: rate.cities,
              countries: rate.countries,
              fee: rate.fee,
              position: i,
            },
          });
        }
      }
    });
    return this.getShipping(userId);
  }

  async requireOwnedShop(userId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { ownerId: userId },
      include: { subscription: true },
    });
    if (!shop) throw new ForbiddenException('Vous devez d’abord créer une boutique');
    return shop;
  }
}
