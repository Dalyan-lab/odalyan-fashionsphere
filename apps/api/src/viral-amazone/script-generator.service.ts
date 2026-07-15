import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductCategory, ProductStatus } from '@prisma/client';
import type { GenerateViralScriptInput } from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ShopService } from '../shop/shop.service';
import { CreditsService } from '../credits/credits.service';
import { TextProvider } from '../ai/providers/text.provider';
import { PaapiProvider } from './providers/paapi.provider';
import { GamificationService } from './gamification.service';

/**
 * Générateur de scripts vidéo viraux (Hook/Problème/Solution/CTA) pour un produit
 * Amazon suivi. Réutilise le TextProvider IA existant et le système de crédits.
 * Le coût est réduit selon le niveau du vendeur (système d'encouragement).
 */
@Injectable()
export class ScriptGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shopService: ShopService,
    private readonly credits: CreditsService,
    private readonly text: TextProvider,
    private readonly paapi: PaapiProvider,
    private readonly gamification: GamificationService,
  ) {}

  async generate(userId: string, input: GenerateViralScriptInput) {
    const shop = await this.shopService.requireOwnedShop(userId);
    const cost = this.gamification.scriptCostFor(shop.creatorTier);
    if (this.text.enabled) await this.credits.ensure(userId, cost);

    const product = await this.prisma.amazonProduct.findUnique({ where: { id: input.productId } });
    if (!product) throw new NotFoundException('Produit Amazon introuvable');

    const { result, provider } = await this.text.generateViralScript({
      productName: product.title,
      category: product.category,
      price: product.currentPrice ? Number(product.currentPrice) : null,
      currency: product.currency,
      platform: input.platform,
    });
    if (provider !== 'mock') await this.credits.consume(userId, cost);

    const trackingId = await this.ensureTrackingId(shop.id);
    const affiliateUrl = this.paapi.buildAffiliateUrl(product.asin, product.marketplace, trackingId);

    const script = await this.prisma.viralScript.create({
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

    await this.gamification.recordActivity(shop.id);
    return script;
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

  /**
   * Ajoute un produit Amazon suivi au catalogue de la boutique, comme produit
   * AFFILIÉ (lien externe). Il rejoint les collections du vendeur et devient
   * utilisable par les outils IA (Studio, Avatars, Vidéo). Idempotent par
   * boutique+ASIN (renvoie l'existant si déjà importé).
   */
  async addToCatalog(userId: string, amazonProductId: string) {
    const shop = await this.shopService.requireOwnedShop(userId);
    const product = await this.prisma.amazonProduct.findUnique({ where: { id: amazonProductId } });
    if (!product) throw new NotFoundException('Produit Amazon introuvable');

    const trackingId = await this.ensureTrackingId(shop.id);
    const affiliateUrl = this.paapi.buildAffiliateUrl(product.asin, product.marketplace, trackingId);

    const existing = await this.prisma.product.findFirst({
      where: { shopId: shop.id, affiliateUrl },
    });
    if (existing) return existing;

    return this.prisma.product.create({
      data: {
        shopId: shop.id,
        name: product.title,
        category: ProductCategory.ACCESSOIRES, // par défaut ; le vendeur peut affiner
        price: product.currentPrice ?? new Prisma.Decimal(0),
        currency: product.currency ?? 'EUR',
        status: ProductStatus.ACTIVE,
        images: product.imageUrl ? [product.imageUrl] : [],
        affiliateUrl,
        sourceMarketplace: product.marketplace,
      },
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
