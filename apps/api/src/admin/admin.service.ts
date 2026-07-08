import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Statuts considérés comme « payés » pour le calcul du chiffre d'affaires. */
const PAID: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

/**
 * Service d'administration : vue globale de la plateforme (toutes boutiques,
 * utilisateurs, commandes). Réservé au rôle ADMIN via le contrôleur.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** Indicateurs globaux de la plateforme. */
  async overview() {
    const [usersByRole, shopsCount, productsCount, orders] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], _count: true }),
      this.prisma.shop.count(),
      this.prisma.product.count(),
      this.prisma.order.findMany({ select: { status: true, totalAmount: true, createdAt: true } }),
    ]);

    const paid = orders.filter((o) => PAID.includes(o.status));
    const revenue = paid.reduce((s, o) => s + Number(o.totalAmount), 0);
    const roles = Object.fromEntries(usersByRole.map((r) => [r.role, r._count])) as Record<string, number>;

    // Revenus des 6 derniers mois (toutes boutiques confondues)
    const now = new Date();
    const monthlyRevenue: { label: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('fr-FR', { month: 'short' });
      const rev = paid
        .filter((o) => o.createdAt.getFullYear() === d.getFullYear() && o.createdAt.getMonth() === d.getMonth())
        .reduce((s, o) => s + Number(o.totalAmount), 0);
      monthlyRevenue.push({ label, revenue: rev });
    }

    return {
      usersCount: usersByRole.reduce((s, r) => s + r._count, 0),
      roles,
      shopsCount,
      productsCount,
      ordersCount: orders.length,
      paidOrdersCount: paid.length,
      revenue,
      monthlyRevenue,
    };
  }

  /** Toutes les boutiques avec propriétaire, plan, produits, commandes, CA. */
  async listShops() {
    const shops = await this.prisma.shop.findMany({
      include: {
        owner: { select: { email: true, firstName: true, lastName: true } },
        subscription: { select: { plan: true, active: true } },
        _count: { select: { products: true, orders: true } },
        orders: { select: { status: true, totalAmount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return shops.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      owner: `${s.owner.firstName} ${s.owner.lastName}`,
      ownerEmail: s.owner.email,
      plan: s.subscription?.plan ?? 'STARTER',
      productsCount: s._count.products,
      ordersCount: s._count.orders,
      revenue: s.orders.filter((o) => PAID.includes(o.status)).reduce((a, o) => a + Number(o.totalAmount), 0),
      createdAt: s.createdAt,
    }));
  }

  /** Tous les utilisateurs de la plateforme. */
  async listUsers() {
    const users = await this.prisma.user.findMany({
      include: { shop: { select: { name: true } }, _count: { select: { orders: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: `${u.firstName} ${u.lastName}`,
      role: u.role,
      shopName: u.shop?.name ?? null,
      ordersCount: u._count.orders,
      createdAt: u.createdAt,
    }));
  }

  /** Commandes récentes, toutes boutiques confondues. */
  async listOrders(limit = 50) {
    const orders = await this.prisma.order.findMany({
      take: Math.min(Math.max(limit, 1), 200),
      orderBy: { createdAt: 'desc' },
      include: {
        shop: { select: { name: true } },
        customer: { select: { email: true, firstName: true, lastName: true } },
      },
    });
    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: Number(o.totalAmount),
      currency: o.currency,
      shop: o.shop.name,
      customer: `${o.customer.firstName} ${o.customer.lastName}`,
      customerEmail: o.customer.email,
      createdAt: o.createdAt,
    }));
  }

  /** Change le rôle d'un utilisateur (interdit de modifier son propre rôle). */
  async setUserRole(actingUserId: string, userId: string, role: UserRole) {
    if (userId === actingUserId) {
      throw new BadRequestException('Vous ne pouvez pas modifier votre propre rôle.');
    }
    if (!Object.values(UserRole).includes(role)) {
      throw new BadRequestException('Rôle invalide.');
    }
    const exists = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Utilisateur introuvable.');
    const user = await this.prisma.user.update({ where: { id: userId }, data: { role } });
    return { id: user.id, role: user.role };
  }
}
