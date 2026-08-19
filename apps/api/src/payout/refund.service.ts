import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { appUrl } from '../common/app-url';
import { computeRefundLines, RefundLineError, type RequestedLine } from './refund-lines';

// Littéraux plutôt que les énumérations générées : Prisma les accepte, et le
// service utilisait déjà des chaînes pour les statuts de commande. Ça évite
// surtout de dépendre d'objets que le client généré n'expose pas partout.
const REFUND_REQUESTED = 'REQUESTED' as const;
const REFUND_APPROVED = 'APPROVED' as const;
const REFUND_REJECTED = 'REJECTED' as const;

/** Statuts depuis lesquels un client peut demander un remboursement. */
const REFUNDABLE = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Le client demande le remboursement d'une commande payée.
   *
   * La demande ne déplace aucun argent : elle ouvre une discussion que le
   * vendeur tranche. Un client qui n'aurait aucun recours dans l'application
   * se tournerait vers sa banque, ce qui coûte bien plus cher à tout le monde.
   */
  async request(userId: string, orderId: string, reason: string, lines?: RequestedLine[]) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { select: { id: true, quantity: true, unitPrice: true } },
        refunds: { select: { status: true, items: { select: { orderItemId: true, quantity: true } } } },
        payment: { select: { paid: true } },
      },
    });
    if (!order || order.customerId !== userId) throw new NotFoundException('Commande introuvable');
    if (!order.payment?.paid) {
      throw new BadRequestException('Cette commande n’a pas été payée : il n’y a rien à rembourser.');
    }
    if (!REFUNDABLE.includes(order.status as (typeof REFUNDABLE)[number])) {
      throw new BadRequestException('Cette commande ne peut plus faire l’objet d’un remboursement.');
    }

    const alreadyRefunded = this.committedQuantities(order.refunds, order.items);
    const remaining = order.items.map((i) => ({
      ...i,
      left: i.quantity - (alreadyRefunded[i.id] ?? 0),
    }));
    if (remaining.every((i) => i.left <= 0)) {
      throw new BadRequestException('Cette commande a déjà été entièrement remboursée.');
    }

    // Sans détail, la demande porte sur tout ce qui reste : c'est ce qu'attend
    // un client qui veut simplement « être remboursé ».
    const asked: RequestedLine[] =
      lines && lines.length > 0
        ? lines
        : remaining.filter((i) => i.left > 0).map((i) => ({ orderItemId: i.id, quantity: i.left }));

    let computed;
    try {
      computed = computeRefundLines({
        items: order.items,
        alreadyRefunded,
        lines: asked,
        shipping: order.shippingAmount,
        // Le taux figé sur la commande, pas celui du jour : reprendre au vendeur
        // une commission qu'il n'a jamais payée serait une erreur.
        rate: order.commissionRate ? Number(order.commissionRate) : 0,
      });
    } catch (err) {
      if (err instanceof RefundLineError) throw new BadRequestException(err.message);
      throw err;
    }

    const refund = await this.prisma.refund.create({
      data: {
        reference: `ODLRB-${randomBytes(3).toString('hex').toUpperCase()}`,
        orderId: order.id,
        amount: computed.amount,
        sellerShare: computed.sellerShare,
        platformShare: computed.platformShare,
        shippingShare: computed.shippingShare,
        full: computed.full,
        reason: reason.trim(),
        items: {
          create: computed.lines.map((l) => ({
            orderItemId: l.orderItemId,
            quantity: l.quantity,
            amount: l.amount,
          })),
        },
      },
    });

    void this.notifySeller(order.id).catch(() => undefined);
    return refund;
  }

  /**
   * Ce qui reste remboursable sur une commande, pour que le client choisisse.
   */
  async refundable(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { select: { id: true, productName: true, quantity: true, unitPrice: true } },
        refunds: { select: { status: true, items: { select: { orderItemId: true, quantity: true } } } },
      },
    });
    if (!order || order.customerId !== userId) throw new NotFoundException('Commande introuvable');

    const done = this.committedQuantities(order.refunds, order.items);
    return {
      currency: order.currency,
      shippingAmount: Number(order.shippingAmount ?? 0),
      items: order.items.map((i) => ({
        id: i.id,
        productName: i.productName,
        unitPrice: Number(i.unitPrice),
        quantity: i.quantity,
        refundable: Math.max(i.quantity - (done[i.id] ?? 0), 0),
      })),
    };
  }

  /**
   * Quantités déjà engagées par article.
   *
   * Les demandes en attente comptent : sans cela, deux demandes déposées coup
   * sur coup passeraient chacune le contrôle et rendraient l'article en double.
   * Un refus, lui, rend ses unités — le client peut redemander.
   */
  private committedQuantities(
    refunds: { status: string; items: { orderItemId: string; quantity: number }[] }[],
    orderItems: { id: string; quantity: number }[],
  ): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const refund of refunds) {
      if (refund.status === REFUND_REJECTED) continue;

      // Les remboursements antérieurs au partiel n'ont pas de lignes : ils
      // portaient la commande entière. Les compter pour zéro laisserait
      // redemander ce qui a déjà été rendu.
      if (refund.items.length === 0) {
        for (const item of orderItems) totals[item.id] = item.quantity;
        continue;
      }
      for (const item of refund.items) {
        totals[item.orderItemId] = (totals[item.orderItemId] ?? 0) + item.quantity;
      }
    }
    return totals;
  }

  /** Demandes reçues par la boutique du vendeur. */
  async listForShop(shopId: string) {
    return this.prisma.refund.findMany({
      where: { order: { shopId } },
      include: {
        order: {
          select: {
            orderNumber: true,
            totalAmount: true,
            currency: true,
            status: true,
            customer: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        items: { select: { quantity: true, orderItem: { select: { productName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Remboursements visibles par le client, sur ses propres commandes. */
  async listForCustomer(userId: string) {
    return this.prisma.refund.findMany({
      where: { order: { customerId: userId } },
      include: {
        order: { select: { orderNumber: true, currency: true } },
        // Détaillés : avec les partiels, « remboursement accordé » ne suffit
        // plus, le client doit voir sur quoi il porte.
        items: { select: { quantity: true, orderItem: { select: { productName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Le vendeur accorde ou refuse.
   *
   * Accorder ne bascule la commande en `REFUNDED` que si plus rien n'y reste
   * remboursable. Une commande partiellement rendue garde son statut : le
   * client a bien reçu ce qu'il conserve, et la vente reste versable pour la
   * part qu'il n'a pas rendue. C'est `sellerShare`, repris en dette, qui porte
   * la reprise — jamais le statut.
   */
  async decide(
    shopId: string,
    refundId: string,
    approve: boolean,
    note?: string,
  ) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        order: {
          select: {
            id: true,
            shopId: true,
            payoutId: true,
            orderNumber: true,
            customer: { select: { email: true } },
            items: { select: { id: true, quantity: true } },
            refunds: {
              select: { id: true, status: true, items: { select: { orderItemId: true, quantity: true } } },
            },
          },
        },
      },
    });
    if (!refund) throw new NotFoundException('Remboursement introuvable');
    if (refund.order.shopId !== shopId) throw new ForbiddenException('Cette commande n’est pas la vôtre.');
    if (refund.status !== REFUND_REQUESTED) {
      throw new BadRequestException('Cette demande a déjà été tranchée.');
    }

    // Recalculé à la décision, sur les seuls remboursements accordés : le
    // caractère complet établi au dépôt supposait que les demandes en attente
    // aboutiraient, ce que le vendeur vient peut-être de démentir.
    const settled = refund.order.refunds.map((r) =>
      r.id === refundId ? { ...r, status: approve ? REFUND_APPROVED : REFUND_REJECTED } : r,
    );
    const approved = this.committedQuantities(
      settled.filter((r) => r.status === REFUND_APPROVED),
      refund.order.items,
    );
    const fullyRefunded = refund.order.items.every(
      (i) => (approved[i.id] ?? 0) >= i.quantity,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.refund.update({
        where: { id: refundId },
        data: {
          status: approve ? REFUND_APPROVED : REFUND_REJECTED,
          decidedAt: new Date(),
          ...(note ? { decisionNote: note.trim() } : {}),
        },
      });
      if (approve && fullyRefunded) {
        await tx.order.update({ where: { id: refund.order.id }, data: { status: 'REFUNDED' } });
      }
      return r;
    });

    void this.mail
      .sendRefundDecision(refund.order.customer.email, {
        orderNumber: refund.order.orderNumber,
        approved: approve,
        note: note?.trim(),
        ordersUrl: `${appUrl()}/orders`,
      })
      .catch(() => undefined);

    return updated;
  }

  /**
   * Dettes d'une boutique : tout remboursement accordé et pas encore compensé.
   *
   * **C'est la règle qui tient toute la comptabilité des versements**, et elle
   * est volontairement unique : une vente crédite le vendeur, un remboursement
   * accordé le débite. Rien d'autre.
   *
   * Le partiel a imposé cette unification. Tant qu'un remboursement portait
   * forcément la commande entière, on pouvait faire plus simple : la commande
   * passait en `REFUNDED` et quittait le solde. Cette astuce ne survit pas au
   * partiel — deux remboursements couvrant chacun la moitié d'une commande non
   * encore versée l'auraient fait sortir du solde **et** créé deux dettes, soit
   * une double reprise. Désormais `eligibleWhere` accepte aussi les commandes
   * remboursées : la vente est comptée, la reprise l'annule, et le net tombe
   * juste dans tous les cas.
   *
   * Seule exception, celle des commandes dont le vendeur n'a jamais rien tiré :
   * remboursées avant livraison, elles ne franchissent pas le seuil de
   * `deliveredAt` et ne seront donc jamais créditées. Leur réclamer une dette
   * laisserait au vendeur un solde négatif permanent, pour de l'argent qu'il
   * n'a jamais reçu.
   */
  async outstandingDebts(shopId: string) {
    return this.prisma.refund.findMany({
      where: {
        status: REFUND_APPROVED,
        settledPayoutId: null,
        order: {
          shopId,
          OR: [{ payoutId: { not: null } }, { deliveredAt: { not: null } }],
        },
      },
      select: { id: true, sellerShare: true, reference: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Prévient le vendeur qu'une demande l'attend. */
  private async notifySeller(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true, shop: { select: { owner: { select: { email: true } } } } },
    });
    if (!order) return;
    await this.mail.sendRefundRequested(order.shop.owner.email, {
      orderNumber: order.orderNumber,
      ordersUrl: `${appUrl()}/dashboard/orders`,
    });
  }
}
