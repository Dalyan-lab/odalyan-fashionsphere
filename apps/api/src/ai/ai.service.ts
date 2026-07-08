import { Injectable } from '@nestjs/common';
import { GeneratedAssetStatus, GeneratedAssetType, Prisma } from '@prisma/client';
import {
  PhotoStyle,
  TRYON_ANGLES,
  type CampaignResult,
  type GenerateAdCopyInput,
  type GenerateAvatarInput,
  type GenerateCampaignInput,
  type GenerateMannequinInput,
  type GenerateTryOnInput,
  type GenerateVideoInput,
  type TryOnResult,
} from '@odalyan/shared';
import { NotFoundException } from '@nestjs/common';
import { VideoRegistry } from './providers/video/video.registry';
import { PrismaService } from '../prisma/prisma.service';
import { ShopService } from '../shop/shop.service';
import { ImageProvider } from './providers/image.provider';
import { TextProvider } from './providers/text.provider';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shopService: ShopService,
    private readonly imageProvider: ImageProvider,
    private readonly textProvider: TextProvider,
    private readonly videoRegistry: VideoRegistry,
  ) {}

  /** Indique au frontend si de vrais providers sont configurés. */
  status() {
    return {
      image: this.imageProvider.enabled ? 'openai' : 'mock',
      text: this.textProvider.enabled ? 'anthropic' : 'mock',
    };
  }

  /** Liste les fournisseurs vidéo disponibles (pour l'UI). */
  listVideoProviders() {
    return this.videoRegistry.list();
  }

  /**
   * Crée une vidéo via le fournisseur choisi (Runway, HeyGen…).
   * Repli simulé si le fournisseur n'a pas de clé configurée.
   */
  async generateVideo(userId: string, input: GenerateVideoInput) {
    const shop = await this.shopService.requireOwnedShop(userId);
    const provider = this.videoRegistry.get(input.providerId);

    // Image source : explicite, sinon l'image du produit
    let imageUrl = input.imageUrl;
    if (!imageUrl && input.productId) {
      const product = await this.prisma.product.findUnique({ where: { id: input.productId } });
      if (product && product.shopId === shop.id) imageUrl = product.images[0];
    }

    // Script parlé pour les fournisseurs de type avatar
    let script = input.script?.trim();
    let scriptProvider: string | undefined;
    if (provider?.kind === 'avatar' && !script) {
      const gen = await this.textProvider.generateScript(
        input.productName ?? 'ce produit',
        input.tone,
        input.language,
      );
      script = gen.script;
      scriptProvider = gen.provider;
    }

    const createInput = {
      productName: input.productName,
      imageUrl,
      prompt: input.prompt,
      script,
      tone: input.tone,
      language: input.language,
      model: input.model,
      ratio: input.ratio,
      duration: input.duration,
    };

    let providerRef: string | null = null;
    let status: GeneratedAssetStatus = GeneratedAssetStatus.READY; // mock par défaut
    let url: string | null = null;
    let usedProvider = 'mock';

    if (provider && provider.enabled) {
      const res = await provider.create(createInput);
      providerRef = res.providerRef;
      url = res.url ?? null;
      usedProvider = provider.id;
      status =
        res.status === 'READY'
          ? GeneratedAssetStatus.READY
          : res.status === 'FAILED'
            ? GeneratedAssetStatus.FAILED
            : GeneratedAssetStatus.PENDING;
    }

    return this.prisma.generatedAsset.create({
      data: {
        type: GeneratedAssetType.AD_VISUAL,
        provider: usedProvider,
        prompt: input.prompt ?? input.productName ?? null,
        url,
        status,
        meta: {
          kind: 'video',
          selectedProvider: input.providerId,
          providerRef,
          routedProvider: provider && provider.enabled ? provider.id : null,
          script: script ?? null,
          scriptProvider: scriptProvider ?? null,
          imageUrl: imageUrl ?? null,
          model: input.model ?? null,
          ratio: input.ratio ?? null,
          duration: input.duration ?? null,
          language: input.language,
        } as Prisma.InputJsonValue,
        ownerId: userId,
        shopId: shop.id,
        productId: input.productId ?? null,
      },
    });
  }

  /** Suit l'avancement d'une génération vidéo (polling), routé par fournisseur. */
  async getVideoStatus(userId: string, assetId: string) {
    const shop = await this.shopService.requireOwnedShop(userId);
    const asset = await this.prisma.generatedAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.shopId !== shop.id) throw new NotFoundException('Vidéo introuvable');

    const meta = (asset.meta ?? {}) as { providerRef?: string | null; routedProvider?: string | null };
    if (asset.status === GeneratedAssetStatus.PENDING && meta.providerRef && meta.routedProvider) {
      const provider = this.videoRegistry.get(meta.routedProvider);
      if (provider?.enabled) {
        const st = await provider.status(meta.providerRef);
        if (st.status !== 'PENDING') {
          return this.prisma.generatedAsset.update({
            where: { id: asset.id },
            data: {
              status: st.status === 'READY' ? GeneratedAssetStatus.READY : GeneratedAssetStatus.FAILED,
              url: st.url ?? asset.url,
            },
          });
        }
      }
    }
    return asset;
  }

  /** Génère des photos mannequin / studio à partir d'un produit ou d'un prompt. */
  async generateMannequin(userId: string, input: GenerateMannequinInput) {
    const shop = await this.shopService.requireOwnedShop(userId);

    let productName = 'un vêtement';
    if (input.productId) {
      const product = await this.prisma.product.findUnique({ where: { id: input.productId } });
      if (product && product.shopId === shop.id) productName = product.name;
    }

    const prompt =
      input.prompt?.trim() ||
      `Photo marketing mode, mannequin ${input.mannequinType}, portant ${productName}, ` +
        `style ${input.style}, rendu professionnel, éclairage ${input.style === PhotoStyle.STUDIO ? 'studio' : 'naturel'}, haute qualité, 8k`;

    const { url, provider } = await this.imageProvider.generate(prompt, input.mannequinType);

    const asset = await this.prisma.generatedAsset.create({
      data: {
        type: input.style === PhotoStyle.STUDIO ? GeneratedAssetType.STUDIO_PHOTO : GeneratedAssetType.MANNEQUIN,
        provider,
        prompt,
        url,
        meta: { mannequinType: input.mannequinType, style: input.style } as Prisma.InputJsonValue,
        ownerId: userId,
        shopId: shop.id,
        productId: input.productId ?? null,
      },
    });

    return asset;
  }

  /** Essayage virtuel : génère le rendu d'un produit sur un mannequin sous 5 angles. */
  async generateTryOn(userId: string, input: GenerateTryOnInput): Promise<TryOnResult> {
    const shop = await this.shopService.requireOwnedShop(userId);

    const product = await this.prisma.product.findUnique({ where: { id: input.productId } });
    if (!product || product.shopId !== shop.id) {
      throw new NotFoundException('Produit introuvable dans votre boutique');
    }

    const extra = input.prompt?.trim() ? `, ${input.prompt.trim()}` : '';

    const views = await Promise.all(
      TRYON_ANGLES.map(async (angle) => {
        const prompt =
          `Essayage virtuel : mannequin ${input.avatarSex}, teint ${input.skinTone}, ` +
          `portant "${product.name}", vue ${angle}${extra}, rendu studio réaliste, plein corps, 8k`;
        const { url, provider } = await this.imageProvider.generate(prompt, input.avatarSex);

        await this.prisma.generatedAsset.create({
          data: {
            type: GeneratedAssetType.MANNEQUIN,
            provider,
            prompt,
            url,
            meta: { kind: 'tryon', angle, productId: product.id } as Prisma.InputJsonValue,
            ownerId: userId,
            shopId: shop.id,
            productId: product.id,
          },
        });

        return { angle, url, provider };
      }),
    );

    return { productName: product.name, views };
  }

  /** Génère un avatar personnalisé à partir de paramètres (création manuelle). */
  async generateAvatar(userId: string, input: GenerateAvatarInput) {
    const shop = await this.shopService.requireOwnedShop(userId);

    const hairstyle = input.hairstyle?.trim() ? `, coiffure ${input.hairstyle}` : '';
    const extra = input.prompt?.trim() ? `, ${input.prompt.trim()}` : '';

    let url: string;
    let provider: string;

    if (input.sourceImageUrl) {
      // Avatar ressemblant à partir d'une photo importée
      const prompt =
        `Transforme cette photo en avatar humain réaliste, ${input.sex}, morphologie ${input.bodyType}, ` +
        `teint ${input.skinTone}${hairstyle}${extra}, portrait studio, en préservant la ressemblance`;
      ({ url, provider } = await this.imageProvider.generateFromImage(prompt, input.sourceImageUrl, input.sex));
    } else {
      const prompt =
        `Portrait en pied d'un avatar humain réaliste, ${input.sex}, morphologie ${input.bodyType}, ` +
        `teint ${input.skinTone}${hairstyle}${extra}, fond neutre studio, plein corps, haute qualité, 8k`;
      ({ url, provider } = await this.imageProvider.generate(prompt, input.sex));
    }

    return this.prisma.generatedAsset.create({
      data: {
        type: GeneratedAssetType.AVATAR,
        provider,
        prompt: input.prompt ?? null,
        url,
        meta: {
          sex: input.sex,
          bodyType: input.bodyType,
          skinTone: input.skinTone,
          hairstyle: input.hairstyle ?? null,
          method: input.sourceImageUrl ? 'photo' : 'manual',
          sourceImageUrl: input.sourceImageUrl ?? null,
        } as Prisma.InputJsonValue,
        ownerId: userId,
        shopId: shop.id,
      },
    });
  }

  /** Génère un texte publicitaire (description, slogans, hashtags, CTA). */
  async generateAdCopy(userId: string, input: GenerateAdCopyInput) {
    const shop = await this.shopService.requireOwnedShop(userId);
    const { result, provider } = await this.textProvider.generateAdCopy(input);

    const asset = await this.prisma.generatedAsset.create({
      data: {
        type: GeneratedAssetType.AD_COPY,
        provider,
        prompt: input.productName,
        meta: result as unknown as Prisma.InputJsonValue,
        ownerId: userId,
        shopId: shop.id,
        productId: input.productId ?? null,
      },
    });

    return { asset, result };
  }

  /**
   * Campagne publicitaire en 1 clic : visuel marketing + texte pub + légendes par réseau.
   */
  async generateCampaign(userId: string, input: GenerateCampaignInput): Promise<CampaignResult> {
    const shop = await this.shopService.requireOwnedShop(userId);

    // Visuel marketing
    const imgPrompt = `Photo publicitaire mode, mannequin portant "${input.productName}", style ${PhotoStyle.LUXE}, composition marketing premium, haute qualité, 8k`;
    const image = await this.imageProvider.generate(imgPrompt, 'Femme');

    // Texte publicitaire
    const { result: copy, provider: textProvider } = await this.textProvider.generateAdCopy({
      productName: input.productName,
      category: input.category,
      tone: input.tone,
    });

    // Légendes prêtes à publier par réseau
    const hashtags = copy.hashtags.map((h) => `#${h}`).join(' ');
    const posts = input.networks.map((network) => ({
      network,
      caption: `${copy.slogans[0] ?? copy.description}\n\n${copy.description}\n\n${copy.cta}\n${hashtags}`,
    }));

    const asset = await this.prisma.generatedAsset.create({
      data: {
        type: GeneratedAssetType.AD_VISUAL,
        provider: image.provider,
        prompt: input.productName,
        url: image.url,
        meta: {
          kind: 'campaign',
          productName: input.productName,
          copy,
          posts,
          networks: input.networks,
          providers: { image: image.provider, text: textProvider },
        } as unknown as Prisma.InputJsonValue,
        ownerId: userId,
        shopId: shop.id,
        productId: input.productId ?? null,
      },
    });

    return {
      id: asset.id,
      productName: input.productName,
      imageUrl: image.url,
      copy,
      posts,
      providers: { image: image.provider, text: textProvider },
      createdAt: asset.createdAt.toISOString(),
    };
  }

  /** Liste les campagnes générées (assets meta.kind=campaign). */
  async listCampaigns(userId: string): Promise<CampaignResult[]> {
    const shop = await this.shopService.requireOwnedShop(userId);
    const assets = await this.prisma.generatedAsset.findMany({
      where: { shopId: shop.id, type: GeneratedAssetType.AD_VISUAL },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    return assets
      .filter((a) => (a.meta as { kind?: string } | null)?.kind === 'campaign')
      .map((a) => {
        const m = a.meta as unknown as {
          productName: string;
          copy: CampaignResult['copy'];
          posts: CampaignResult['posts'];
          providers: CampaignResult['providers'];
        };
        return {
          id: a.id,
          productName: m.productName,
          imageUrl: a.url,
          copy: m.copy,
          posts: m.posts,
          providers: m.providers,
          createdAt: a.createdAt.toISOString(),
        };
      });
  }

  /** Liste les contenus générés par la boutique du vendeur. */
  async listAssets(userId: string, type?: string) {
    const shop = await this.shopService.requireOwnedShop(userId);
    return this.prisma.generatedAsset.findMany({
      where: { shopId: shop.id, ...(type ? { type: type as GeneratedAssetType } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });
  }
}
