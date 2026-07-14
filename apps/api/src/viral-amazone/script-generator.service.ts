import { Injectable, NotFoundException } from '@nestjs/common';
import { AI_CREDIT_COSTS, type GenerateViralScriptInput } from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ShopService } from '../shop/shop.service';
import { CreditsService } from '../credits/credits.service';
import { TextProvider } from '../ai/providers/text.provider';
import { PaapiProvider } from './providers/paapi.provider';

/**
 * Générateur de scripts vidéo viraux (Hook/Problème/Solution/CTA) pour un produit
 * Amazon suivi. Réutilise le TextProvider IA existant et le système de crédits.
 */
@Injectable()
export class ScriptGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shopService: ShopService,
    private readonly credits: CreditsService,
    private readonly text: TextProvider,
    private readonly paapi: PaapiProvider,
  ) {}

  async generate(userId: string, input: GenerateViralScriptInput) {
    const shop = await this.shopService.requireOwnedShop(userId);
    if (this.text.enabled) await this.credits.ensure(userId, AI_CREDIT_COSTS.viralScript);

    const product = await this.prisma.amazonProduct.findUnique({ where: { id: input.productId } });
    if (!product) throw new NotFoundException('Produit Amazon introuvable');

    const { result, provider } = await this.text.generateViralScript({
      productName: product.title,
      category: product.category,
      price: product.currentPrice ? Number(product.currentPrice) : null,
      currency: product.currency,
      platform: input.platform,
    });
    if (provider !== 'mock') await this.credits.consume(userId, AI_CREDIT_COSTS.viralScript);

    const trackingId = await this.ensureTrackingId(shop.id);
    const affiliateUrl = this.paapi.buildAffiliateUrl(product.asin, product.marketplace, trackingId);

    return this.prisma.viralScript.create({
      data: {
        shopId: shop.id,
        productId: product.id,
        platform: input.platform,
        hook: result.hook,
        problem: result.problem,
        solution: result.solution,
        cta: result.cta,
        affiliateUrl,
        provider,
      },
    });
  }

  async list(userId: string) {
    const shop = await this.shopService.requireOwnedShop(userId);
    return this.prisma.viralScript.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: { product: true },
    });
  }

  /** Attribue un identifiant de suivi d'affiliation stable au vendeur (une fois, à la volée). */
  private async ensureTrackingId(shopId: string): Promise<string> {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId }, select: { affiliateTrackingId: true } });
    if (shop?.affiliateTrackingId) return shop.affiliateTrackingId;
    // L'id de boutique (cuid) est déjà globalement unique : on le réutilise tel quel comme sub-tag.
    await this.prisma.shop.update({ where: { id: shopId }, data: { affiliateTrackingId: shopId } });
    return shopId;
  }
}
