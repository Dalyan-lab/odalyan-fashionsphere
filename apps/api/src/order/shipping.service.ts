import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ShippingDestination {
  country?: string;
  city?: string;
}

/**
 * Normalise un libellé de lieu pour la comparaison.
 *
 * Les acheteurs écrivent « ABIDJAN », « abidjan » ou « Abidjan  » ; les
 * vendeurs saisissent leurs zones tout aussi librement. Sans normalisation,
 * un tarif configuré ne s'appliquerait qu'à l'orthographe exacte du vendeur.
 */
function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Frais de livraison d'une boutique pour une destination et un sous-total.
   *
   * L'ordre compte : le seuil de gratuité l'emporte sur toute zone, puis la
   * première zone qui correspond gagne, et à défaut le tarif de base
   * s'applique. Une boutique sans aucun réglage livre gratuitement.
   */
  async feeFor(
    shopId: string,
    subtotal: Prisma.Decimal,
    to: ShippingDestination,
  ): Promise<Prisma.Decimal> {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        shippingFee: true,
        freeShippingFrom: true,
        shippingRates: { orderBy: { position: 'asc' } },
      },
    });
    if (!shop) return new Prisma.Decimal(0);

    if (shop.freeShippingFrom && subtotal.gte(shop.freeShippingFrom)) {
      return new Prisma.Decimal(0);
    }

    const city = to.city ? normalize(to.city) : null;
    const country = to.country ? normalize(to.country) : null;

    for (const rate of shop.shippingRates) {
      // Liste vide = « toutes » : une zone sans ville ni pays est un
      // attrape-tout, volontairement placé en dernière position.
      const cityOk = rate.cities.length === 0 || (city !== null && rate.cities.some((c) => normalize(c) === city));
      const countryOk =
        rate.countries.length === 0 ||
        (country !== null && rate.countries.some((c) => normalize(c) === country));
      if (cityOk && countryOk) return new Prisma.Decimal(rate.fee);
    }

    return new Prisma.Decimal(shop.shippingFee ?? 0);
  }

  /** Tarif le plus bas affiché sur une fiche produit, à titre indicatif. */
  async cheapestFor(shopId: string): Promise<number | null> {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { shippingFee: true, shippingRates: { select: { fee: true } } },
    });
    if (!shop) return null;
    const fees = [
      ...(shop.shippingFee ? [Number(shop.shippingFee)] : []),
      ...shop.shippingRates.map((r) => Number(r.fee)),
    ];
    return fees.length ? Math.min(...fees) : null;
  }
}
