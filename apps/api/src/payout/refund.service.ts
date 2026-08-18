import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { appUrl } from '../common/app-url';

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
  async request(userId: string, orderId: string, reason: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { refund: true, payment: { select: { paid: true } } },
    });
    if (!order || order.customerId !== userId) throw new NotFoundException('Commande introuvable');
    if (order.refund) throw new BadRequestException('Un remboursement est déjà en cours pour cette commande.');
    if (!order.payment?.paid) {
      throw new BadRequestException('Cette commande n’a pas été payée : il n’y a rien à rembourser.');
    }
    if (!REFUNDABLE.includes(order.status as (typeof REFUNDABLE)[number])) {
      throw new BadRequestException('Cette commande ne peut plus faire l’objet d’un remboursement.');
    }

    // Les parts sont recopiées de la commande : elles y ont été figées à
    // l'encaissement, avec le taux de commission en vigueur ce jour-là.
    const refund = await this.prisma.refund.create({
      data: {
        reference: `ODLRB-${randomBytes(3).toString('hex').toUpperCase()}`,
        orderId: order.id,
        amount: order.totalAmount,
        sellerShare: order.sellerAmount ?? order.totalAmount,
        platformShare: order.platformAmount ?? 0,
        reason: reason.trim(),
      },
    });

    void this.notifySeller(order.id).catch(() => undefined);
    return refund;
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Remboursements visibles par le client, sur ses propres commandes. */
  async listForCustomer(userId: string) {
    return this.prisma.refund.findMany({
      where: { order: { customerId: userId } },
      include: { order: { select: { orderNumber: true, currency: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Le vendeur accorde ou refuse.
   *
   * Accorder bascule la commande en `REFUNDED`, ce qui la sort mécaniquement
   * des montants versables : `eligibleWhere` n'accepte que les commandes
   * livrées. Si elle avait **déjà** été versée, `sellerShare` devient une
   * dette que le prochain versement absorbera.
   */
  async decide(
    shopId: string,
    refundId: string,
    approve: boolean,
    note?: string,
  ) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: { order: { select: { id: true, shopId: true, payoutId: true, orderNumber: true, customer: { select: { email: true } } } } },
    });
    if (!refund) throw new NotFoundException('Remboursement introuvable');
    if (refund.order.shopId !== shopId) throw new ForbiddenException('Cette commande n’est pas la vôtre.');
    if (refund.status !== REFUND_REQUESTED) {
      throw new BadRequestException('Cette demande a déjà été tranchée.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.refund.update({
        where: { id: refundId },
        data: {
          status: approve ? REFUND_APPROVED : REFUND_REJECTED,
          decidedAt: new Date(),
          ...(note ? { decisionNote: note.trim() } : {}),
        },
      });
      if (approve) {
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
   * Dettes d'une boutique : remboursements accordés sur des commandes déjà
   * versées, et pas encore compensés.
   *
   * Un remboursement sur une commande non versée n'apparaît pas ici : la
   * commande étant passée en `REFUNDED`, elle a simplement quitté le solde.
   */
  async outstandingDebts(shopId: string) {
    return this.prisma.refund.findMany({
      where: {
        status: REFUND_APPROVED,
        settledPayoutId: null,
        order: { shopId, payoutId: { not: null } },
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
