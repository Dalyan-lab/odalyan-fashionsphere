import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Littéral plutôt que l'énumération générée — voir RefundService. */
const PAYOUT_PAID = 'PAID' as const;
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { computeOrderSplit } from './order-split';
import { computePayoutAmount } from './payout-amount';
import { RefundService } from './refund.service';

/** Commission de la plateforme quand la boutique n'a pas de taux négocié. */
const DEFAULT_COMMISSION_RATE = 0.1;

/**
 * Délai de garantie après livraison, avant qu'une vente ne devienne versable.
 *
 * Reverser dès la livraison exposerait la plateforme : un remboursement
 * réclamé après coup porterait sur de l'argent déjà sorti.
 */
const DEFAULT_HOLD_DAYS = 7;

function platformCommissionRate(): number {
  const raw = Number(process.env.PLATFORM_COMMISSION_RATE);
  return Number.isFinite(raw) && raw >= 0 && raw < 1 ? raw : DEFAULT_COMMISSION_RATE;
}

function holdDays(): number {
  const raw = Number(process.env.PAYOUT_HOLD_DAYS);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_HOLD_DAYS;
}

@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly refunds: RefundService,
  ) {}

  /**
   * Fige la part du vendeur et celle de la plateforme sur une commande payée.
   *
   * Appelé une seule fois, à l'encaissement. Le taux appliqué est recopié sur
   * la commande : c'est ce qui permet de changer la commission plus tard sans
   * réécrire l'historique des ventes déjà conclues.
   */
  async recordOrderSplit(orderId: string): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { shop: { select: { commissionRate: true } } },
      });
      // Déjà réparti : un second appel (double webhook, reprise) ne doit pas
      // recalculer avec un taux qui aurait changé entre-temps.
      if (!order || order.sellerAmount !== null) return;

      const rate = order.shop.commissionRate
        ? Number(order.shop.commissionRate)
        : platformCommissionRate();

      // Le calcul lui-même vit dans un module pur, couvert par des tests :
      // c'est le point où une erreur se traduirait en argent mal versé.
      const split = computeOrderSplit({
        total: order.totalAmount,
        shipping: order.shippingAmount,
        rate,
      });

      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          commissionRate: new Prisma.Decimal(rate),
          platformAmount: new Prisma.Decimal(split.platformAmount),
          sellerAmount: new Prisma.Decimal(split.sellerAmount),
        },
      });
    } catch (err) {
      // Ne doit jamais faire échouer un encaissement : la commande est payée,
      // la répartition se rattrape.
      this.logger.error(`Répartition non enregistrée (${orderId}) : ${String(err)}`);
    }
  }

  /**
   * Commandes versables : livrées, sorties du délai de garantie, non encore
   * rattachées à un versement.
   */
  private eligibleWhere(shopId?: string): Prisma.OrderWhereInput {
    const cutoff = new Date(Date.now() - holdDays() * 24 * 60 * 60 * 1000);
    return {
      ...(shopId ? { shopId } : {}),
      status: 'DELIVERED',
      deliveredAt: { lte: cutoff },
      payoutId: null,
      sellerAmount: { not: null },
      payment: { is: { paid: true } },
    };
  }

  /** Solde d'une boutique, décomposé pour que le vendeur comprenne l'attente. */
  async balance(shopId: string) {
    const paidUnpaidOrders = {
      shopId,
      payoutId: null,
      sellerAmount: { not: null },
      payment: { is: { paid: true } },
    } satisfies Prisma.OrderWhereInput;

    const [available, delivered, pending, paidOut] = await Promise.all([
      this.prisma.order.aggregate({
        where: this.eligibleWhere(shopId),
        _sum: { sellerAmount: true },
        _count: true,
      }),
      // Livrées mais encore sous garantie
      this.prisma.order.aggregate({
        where: {
          ...paidUnpaidOrders,
          status: 'DELIVERED',
          deliveredAt: { gt: new Date(Date.now() - holdDays() * 24 * 60 * 60 * 1000) },
        },
        _sum: { sellerAmount: true },
        _count: true,
      }),
      // Payées, pas encore livrées
      this.prisma.order.aggregate({
        where: { ...paidUnpaidOrders, status: { in: ['PAID', 'PROCESSING', 'SHIPPED'] } },
        _sum: { sellerAmount: true },
        _count: true,
      }),
      this.prisma.payout.aggregate({
        where: { shopId, status: PAYOUT_PAID },
        _sum: { amount: true },
      }),
    ]);

    const num = (d: Prisma.Decimal | null) => Number(d ?? 0);
    // Remboursements accordés sur des commandes déjà versées : le vendeur
    // détient de l'argent qui ne lui revient plus. On l'annonce plutôt que de
    // le lui retirer sans prévenir au prochain versement.
    const debts = await this.refunds.outstandingDebts(shopId);
    const debt = debts.reduce((sum, d) => sum + Number(d.sellerShare), 0);

    return {
      debt,
      debtCount: debts.length,
      available: num(available._sum.sellerAmount),
      availableOrders: available._count,
      onHold: num(delivered._sum.sellerAmount),
      onHoldOrders: delivered._count,
      pending: num(pending._sum.sellerAmount),
      pendingOrders: pending._count,
      totalPaidOut: num(paidOut._sum.amount),
      holdDays: holdDays(),
      commissionRate: platformCommissionRate(),
    };
  }

  /** Historique des versements d'une boutique. */
  async listForShop(shopId: string) {
    return this.prisma.payout.findMany({
      where: { shopId },
      include: { orders: { select: { orderNumber: true, sellerAmount: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Boutiques ayant un montant versable, pour l'écran d'administration. */
  async pending() {
    const grouped = await this.prisma.order.groupBy({
      by: ['shopId'],
      where: this.eligibleWhere(),
      _sum: { sellerAmount: true },
      _count: true,
    });
    if (grouped.length === 0) return [];

    const shops = await this.prisma.shop.findMany({
      where: { id: { in: grouped.map((g) => g.shopId) } },
      select: {
        id: true,
        name: true,
        payoutMethod: true,
        payoutOperator: true,
        payoutNumber: true,
        payoutHolderName: true,
      },
    });

    return grouped.map((g) => {
      const shop = shops.find((s) => s.id === g.shopId);
      return {
        shopId: g.shopId,
        shopName: shop?.name ?? '—',
        amount: Number(g._sum.sellerAmount ?? 0),
        orders: g._count,
        // Sans coordonnées, l'administrateur ne peut pas payer : on le dit
        // plutôt que de laisser un versement se créer dans le vide.
        payoutReady: Boolean(shop?.payoutNumber),
        method: shop?.payoutMethod ?? null,
        operator: shop?.payoutOperator ?? null,
        number: shop?.payoutNumber ?? null,
        holderName: shop?.payoutHolderName ?? null,
      };
    });
  }

  /**
   * Crée le versement d'une boutique en y rattachant ses commandes versables.
   *
   * Le rattachement et la création sont dans une transaction : une commande
   * doit appartenir à un versement et un seul, sous peine d'être payée deux fois.
   */
  async create(shopId: string) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Boutique introuvable');
    if (!shop.payoutNumber) {
      throw new BadRequestException(
        'Ce vendeur n’a pas renseigné ses coordonnées de reversement.',
      );
    }

    const orders = await this.prisma.order.findMany({
      where: this.eligibleWhere(shopId),
      select: { id: true, sellerAmount: true, currency: true },
    });
    if (orders.length === 0) throw new BadRequestException('Aucune commande versable.');

    const eligibleTotal = orders.reduce(
      (sum, o) => sum.add(o.sellerAmount!),
      new Prisma.Decimal(0),
    );

    // Les remboursements accordés sur des commandes déjà versées sont retenus
    // ici. Le calcul vit dans un module pur, couvert par des tests : il garantit
    // qu'un versement ne devient jamais négatif et qu'une dette est absorbée
    // entièrement ou reportée, jamais réglée à moitié.
    const debts = await this.refunds.outstandingDebts(shopId);
    const computed = computePayoutAmount({
      eligibleTotal,
      debts: debts.map((d) => ({ id: d.id, amount: d.sellerShare })),
    });
    const amount = new Prisma.Decimal(computed.amount);

    return this.prisma.$transaction(async (tx) => {
      const payout = await tx.payout.create({
        data: {
          reference: `ODLPO-${randomBytes(4).toString('hex').toUpperCase()}`,
          shopId,
          amount,
          currency: orders[0]!.currency,
          method: shop.payoutMethod,
          destination: [shop.payoutOperator, shop.payoutNumber, shop.payoutHolderName]
            .filter(Boolean)
            .join(' · '),
        },
      });
      await tx.order.updateMany({
        where: { id: { in: orders.map((o) => o.id) } },
        data: { payoutId: payout.id },
      });
      if (computed.settledDebtIds.length) {
        await tx.refund.updateMany({
          where: { id: { in: computed.settledDebtIds } },
          data: { settledPayoutId: payout.id },
        });
      }
      return payout;
    });
  }

  /** Marque un versement comme effectué, avec la référence du virement. */
  async markPaid(payoutId: string, transferRef?: string, note?: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('Versement introuvable');
    if (payout.status === PAYOUT_PAID) return payout;

    return this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: PAYOUT_PAID,
        paidAt: new Date(),
        ...(transferRef ? { transferRef } : {}),
        ...(note ? { note } : {}),
      },
    });
  }

  /**
   * Annule un versement non payé et rend ses commandes au solde disponible.
   *
   * Sans cette sortie, une erreur de saisie immobiliserait définitivement les
   * commandes rattachées.
   */
  async cancel(payoutId: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('Versement introuvable');
    if (payout.status === PAYOUT_PAID) {
      throw new BadRequestException('Un versement déjà payé ne peut pas être annulé.');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.order.updateMany({ where: { payoutId }, data: { payoutId: null } });
      return tx.payout.delete({ where: { id: payoutId } });
    });
  }
}
