import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveShippingFee } from './shipping-rules';

export interface ShippingDestination {
  country?: string;
  city?: string;
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

    // Le choix du tarif vit dans un module pur, couvert par des tests : c'est
    // ce qui est facturé au client, une erreur s'y voit tout de suite.
    const fee = resolveShippingFee(
      {
        shippingFee: shop.shippingFee,
        freeShippingFrom: shop.freeShippingFrom,
        zones: shop.shippingRates,
      },
      subtotal,
      to,
    );
    return new Prisma.Decimal(fee);
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
