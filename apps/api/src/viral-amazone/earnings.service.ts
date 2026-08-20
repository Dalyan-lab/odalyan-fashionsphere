import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AFFILIATE_MIN_WITHDRAWAL,
  TIER_AFFILIATE_SHARE,
  type CreatorBalanceDto,
  type CreatorTier,
} from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ShopService } from '../shop/shop.service';

/** Littéraux plutôt que l'énumération générée — voir RefundService. */
const REQUESTED = 'REQUESTED' as const;
const PAID = 'PAID' as const;
const REJECTED = 'REJECTED' as const;

/**
 * Gains ViralAmazone d'une boutique, en francs CFA.
 *
 * **Rien ne relie ce registre aux crédits IA, et c'est délibéré.** Les crédits
 * s'achètent ; les rendre convertibles permettrait d'acheter un pack puis de
 * l'encaisser, et la plateforme paierait deux fois. Seules les performances
 * d'affiliation créditent ici.
 *
 * Le solde n'est pas stocké : il s'additionne depuis les écritures. Un solde
 * conservé à part finit toujours par diverger de son historique, et c'est
 * précisément le chiffre qu'un vendeur contestera.
 */
@Injectable()
export class EarningsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shopService: ShopService,
  ) {}

  async balance(userId: string): Promise<CreatorBalanceDto> {
    const shop = await this.shopService.requireOwnedShop(userId);
    const entries = await this.prisma.creatorEarning.findMany({
      where: { shopId: shop.id, status: { not: REJECTED } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Les écritures annulées sont exclues de la lecture comme du calcul : une
    // ligne visible mais non comptée ferait douter du total.
    const sommes = await this.prisma.creatorEarning.groupBy({
      by: ['status'],
      where: { shopId: shop.id, status: { not: REJECTED } },
      _sum: { amount: true },
    });
    const total = (statut: string) =>
      Number(sommes.find((s) => s.status === statut)?._sum.amount ?? 0);

    // Un seul principe : les gains sont positifs, les retraits négatifs, et le
    // disponible est leur somme. Basculer les gains en « versé » au moment de
    // la demande afficherait comme payé de l'argent qui ne l'est pas encore.
    const available = sommes.reduce((t, s) => t + Number(s._sum.amount ?? 0), 0);
    const requested = Math.abs(total(REQUESTED));
    const paidOut = Math.abs(total(PAID));

    const share = TIER_AFFILIATE_SHARE[shop.creatorTier as CreatorTier] ?? 0;

    return {
      available,
      requested,
      paidOut,
      currency: 'XOF',
      minWithdrawal: AFFILIATE_MIN_WITHDRAWAL,
      sharePercent: Math.round(share * 100),
      canWithdraw: available >= AFFILIATE_MIN_WITHDRAWAL && Boolean(shop.payoutNumber),
      entries: entries.map((e) => ({
        id: e.id,
        amount: Number(e.amount),
        currency: e.currency,
        status: e.status as CreatorBalanceDto['entries'][number]['status'],
        kind: e.kind,
        note: e.note,
        createdAt: e.createdAt.toISOString(),
        paidAt: e.paidAt?.toISOString() ?? null,
      })),
    };
  }

  /**
   * Le vendeur demande le retrait de ses gains disponibles.
   *
   * Enregistré comme une écriture négative : le solde disponible baisse
   * immédiatement, donc une seconde demande ne peut pas retirer la même somme.
   */
  async requestWithdrawal(userId: string): Promise<{ requested: number }> {
    const shop = await this.shopService.requireOwnedShop(userId);

    if (!shop.payoutNumber) {
      throw new BadRequestException(
        'Renseignez d’abord vos coordonnées de reversement dans « Mes revenus ».',
      );
    }

    // Même règle que l'affichage : les retraits déjà enregistrés sont négatifs
    // et se déduisent d'eux-mêmes. Ne sommer que les gains laisserait demander
    // deux fois la même somme.
    const somme = await this.prisma.creatorEarning.aggregate({
      where: { shopId: shop.id, status: { not: REJECTED } },
      _sum: { amount: true },
    });
    const disponible = Number(somme._sum.amount ?? 0);

    if (disponible < AFFILIATE_MIN_WITHDRAWAL) {
      throw new BadRequestException(
        `Le retrait est possible à partir de ${AFFILIATE_MIN_WITHDRAWAL.toLocaleString('fr-FR')} FCFA. ` +
          `Vous en avez ${disponible.toLocaleString('fr-FR')}.`,
      );
    }

    // Une seule écriture négative : elle fait baisser le disponible aussitôt,
    // donc une seconde demande ne peut pas retirer la même somme. Les gains
    // d'origine restent intacts, lisibles dans l'historique.
    await this.prisma.creatorEarning.create({
        data: {
          shopId: shop.id,
          amount: -disponible,
          kind: 'withdrawal',
          status: REQUESTED,
          note: 'Retrait demandé',
          destination: [shop.payoutOperator, shop.payoutNumber, shop.payoutHolderName]
            .filter(Boolean)
            .join(' · '),
        },
    });

    return { requested: disponible };
  }

  /** Crédite les gains d'une boutique. Réservé à l'administration. */
  async credit(shopId: string, amount: number, note?: string) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Le montant doit être positif.');
    }
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Boutique introuvable');

    return this.prisma.creatorEarning.create({
      data: { shopId, amount, kind: 'affiliate', note: note?.trim() || null },
    });
  }

  /** Marque un retrait comme versé, avec la référence du virement. */
  async markWithdrawalPaid(id: string, transferRef?: string) {
    const ecriture = await this.prisma.creatorEarning.findUnique({ where: { id } });
    if (!ecriture) throw new NotFoundException('Écriture introuvable');
    if (ecriture.status !== REQUESTED) {
      throw new BadRequestException('Cette écriture n’est pas un retrait en attente.');
    }
    return this.prisma.creatorEarning.update({
      where: { id },
      data: { status: PAID, paidAt: new Date(), ...(transferRef ? { transferRef } : {}) },
    });
  }

  /** Retraits en attente de virement, pour l'administration. */
  async pendingWithdrawals() {
    return this.prisma.creatorEarning.findMany({
      where: { status: REQUESTED },
      include: { shop: { select: { name: true, slug: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }
}
