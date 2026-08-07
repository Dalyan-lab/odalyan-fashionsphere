import { Injectable } from '@nestjs/common';
import { GeneratedAssetStatus, GeneratedAssetType, Prisma } from '@prisma/client';
import {
  AI_CREDIT_COSTS,
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
import { CreditsService } from '../credits/credits.service';
import { ImageProvider, type ImageResult } from './providers/image.provider';
import { TextProvider } from './providers/text.provider';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shopService: ShopService,
    private readonly credits: CreditsService,
    private readonly imageProvider: ImageProvider,
    private readonly textProvider: TextProvider,
    private readonly videoRegistry: VideoRegistry,
  ) {}

  /** Indique au frontend si de vrais providers sont configurés. */
  status() {
    return {
      image: this.imageProvider.providerName,
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
    if (provider?.enabled) await this.credits.ensure(userId, AI_CREDIT_COSTS.video);

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
      // Débit uniquement si la génération a bien démarré (pas d'échec immédiat).
      if (status !== GeneratedAssetStatus.FAILED) {
        await this.credits.consume(userId, AI_CREDIT_COSTS.video);
      }
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
    if (this.imageProvider.enabled) await this.credits.ensure(userId, AI_CREDIT_COSTS.image);

    let productName = 'un vêtement';
    let productImage: string | undefined;
    if (input.productId) {
      const product = await this.prisma.product.findUnique({ where: { id: input.productId } });
      if (product && product.shopId === shop.id) {
        productName = product.name;
        productImage = product.images[0];
      }
    }
    // Avatar à habiller : l'avatar sert de base. Avec une photo produit → vrai essayage
    // 2-images (fidélité maximale du vêtement). Sinon, produit décrit dans le prompt.
    let avatarImage: string | undefined;
    if (input.avatarAssetId) {
      const avatar = await this.prisma.generatedAsset.findUnique({ where: { id: input.avatarAssetId } });
      if (avatar && avatar.shopId === shop.id && avatar.url) avatarImage = avatar.url;
    }
    const garmentImage = input.sourceImageUrl ?? productImage;
    const sourceImageUrl = avatarImage ?? garmentImage; // base réellement utilisée (pour la meta)

    const lighting = input.style === PhotoStyle.STUDIO ? 'studio' : 'naturel';
    let url: string;
    let provider: string;
    let prompt: string;

    let tryOnMode: string | null = null;
    let tryOnError: string | null = null;
    if (avatarImage && garmentImage) {
      // Essayage 2-images : le VRAI vêtement composé sur l'avatar (idm-vton).
      prompt = `Essayage virtuel : ${productName} sur l'avatar`;
      const tryon = await this.imageProvider.virtualTryOn(
        avatarImage,
        garmentImage,
        productName,
        input.garmentCategory ?? 'upper_body',
      );
      if (tryon.provider !== 'mock') {
        ({ url, provider } = tryon);
        tryOnMode = '2img';
      } else {
        // Repli si le modèle try-on échoue : on habille l'avatar via flux-kontext.
        tryOnError = tryon.error ?? null;
        prompt =
          `Habille cette personne avec ${productName}, en conservant fidèlement son visage, sa morphologie ` +
          `et sa coiffure. Photo mode, style ${input.style}, plein cadre, éclairage ${lighting}, rendu professionnel, haute qualité, 8k`;
        const fb = await this.imageProvider.generateFromImage(prompt, avatarImage, input.mannequinType);
        ({ url, provider } = fb);
        if (fb.error) tryOnError = `${tryOnError ?? ''} | kontext: ${fb.error}`.trim();
        tryOnMode = 'fallback-kontext';
      }
    } else if (avatarImage) {
      prompt =
        input.prompt?.trim() ||
        `Habille cette personne avec ${productName}, en conservant fidèlement son visage, sa morphologie ` +
          `et sa coiffure. Photo mode, style ${input.style}, plein cadre, éclairage ${lighting}, rendu professionnel, haute qualité, 8k`;
      ({ url, provider } = await this.imageProvider.generateFromImage(prompt, avatarImage, input.mannequinType));
    } else if (garmentImage) {
      prompt =
        input.prompt?.trim() ||
        `Photo marketing mode : fais porter ce vêtement/produit par un mannequin ${input.mannequinType}, ` +
          `style ${input.style}, plein cadre, rendu professionnel, éclairage ${lighting}, haute qualité, 8k, en conservant fidèlement le produit`;
      ({ url, provider } = await this.imageProvider.generateFromImage(prompt, garmentImage, input.mannequinType));
    } else {
      prompt =
        input.prompt?.trim() ||
        `Photo marketing mode, mannequin ${input.mannequinType}, portant ${productName}, ` +
          `style ${input.style}, rendu professionnel, éclairage ${lighting}, haute qualité, 8k`;
      ({ url, provider } = await this.imageProvider.generate(prompt, input.mannequinType));
    }
    if (provider !== 'mock') await this.credits.consume(userId, AI_CREDIT_COSTS.image);

    const asset = await this.prisma.generatedAsset.create({
      data: {
        type: input.style === PhotoStyle.STUDIO ? GeneratedAssetType.STUDIO_PHOTO : GeneratedAssetType.MANNEQUIN,
        provider,
        prompt,
        url,
        meta: {
          mannequinType: input.mannequinType,
          style: input.style,
          fromImage: Boolean(sourceImageUrl),
          sourceImageUrl: sourceImageUrl ?? null,
          avatarAssetId: input.avatarAssetId ?? null,
          tryOnMode,
          tryOnError,
        } as Prisma.InputJsonValue,
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
    if (this.imageProvider.enabled) await this.credits.ensure(userId, AI_CREDIT_COSTS.tryon);

    // Personnalisation par l'avatar choisi (sexe, teint, morphologie, coiffure)
    let sex: string = input.avatarSex;
    let skinTone: string = input.skinTone;
    let bodyType = '';
    let hairstyle = '';
    if (input.avatarAssetId) {
      const avatar = await this.prisma.generatedAsset.findUnique({ where: { id: input.avatarAssetId } });
      const meta = (avatar?.meta ?? {}) as Record<string, string | null>;
      if (avatar && avatar.shopId === shop.id) {
        sex = meta.sex ?? sex;
        skinTone = meta.skinTone ?? skinTone;
        bodyType = meta.bodyType ? `, morphologie ${meta.bodyType}` : '';
        hairstyle = meta.hairstyle ? `, coiffure ${meta.hairstyle}` : '';
      }
    }
    const extra = input.prompt?.trim() ? `, ${input.prompt.trim()}` : '';
    // Photo produit → image→image (vrai produit) ; sinon texte→image (repli)
    const productImage = product.images[0];

    // Génération SÉQUENTIELLE (et non Promise.all) : 5 requêtes simultanées font
    // saturer le débit Replicate (429) → repli sur des images sans rapport. En série,
    // chaque angle aboutit vraiment.
    // Formulation d'angle claire pour le modèle (le libellé sert aussi de tag UI).
    // Directions explicites et OPPOSÉES pour les deux profils (sinon le modèle
    // produit deux vues identiques).
    const ANGLE_PROMPT: Record<string, string> = {
      Face: 'de face, regardant l’objectif',
      'Côté gauche': 'de profil gauche : la femme est tournée vers la GAUCHE de l’image (on voit le côté gauche de son corps)',
      Dos: 'de dos, tournant complètement le dos à l’objectif',
      'Côté droit': 'de profil droit : la femme est tournée vers la DROITE de l’image (on voit le côté droit de son corps)',
    };

    const views: { angle: string; url: string; provider: string }[] = [];
    let realCount = 0;
    // Image de RÉFÉRENCE : la 1ʳᵉ vue (Face) sert de base aux autres angles, pour
    // garder la MÊME personne et la MÊME tenue (sinon chaque angle recrée un
    // mannequin différent). On repart de la photo produit seulement pour la Face.
    let refImage: string | undefined = productImage;
    for (const [i, angle] of TRYON_ANGLES.entries()) {
      const isFace = i === 0;
      const base =
        `Photo mode studio, plein corps, femme réaliste et photoréaliste (PAS un mannequin de vitrine en plastique), ` +
        `teint ${skinTone}${bodyType}${hairstyle}, vue ${ANGLE_PROMPT[angle] ?? angle}${extra}, fond neutre clair, 8k. `;
      const prompt = isFace
        ? base +
          (productImage
            ? 'Une femme porte EXACTEMENT le vêtement de la photo : même TYPE (si c’est une robe, garder une robe — ' +
              'jamais un pantalon/combinaison), même coupe, mêmes couleurs et mêmes motifs.'
            : `Une femme ${sex} porte "${product.name}".`)
        : base +
          'IMPORTANT : reprends EXACTEMENT la même femme et le même vêtement que sur l’image de référence ' +
          '(même visage, même coiffure, même peau, même robe, mêmes motifs et couleurs), en la faisant simplement ' +
          `pivoter pour être vue ${ANGLE_PROMPT[angle] ?? angle}. Ne change ni la personne ni la tenue.`;

      const res: ImageResult = refImage
        ? await this.imageProvider.generateFromImage(prompt, refImage, sex)
        : await this.imageProvider.generate(prompt, sex);

      // Si l'IA est branchée mais que CET angle a échoué (débit), on garde la VRAIE
      // photo produit plutôt qu'une image de démo aléatoire sans rapport.
      const failedButAiOn = res.provider === 'mock' && this.imageProvider.enabled && Boolean(productImage);
      const url = failedButAiOn ? productImage! : res.url;
      const provider = failedButAiOn ? 'product' : res.provider;
      if (res.provider !== 'mock') realCount++;
      // La Face réussie devient la référence identité/tenue pour les 3 autres angles.
      if (isFace && res.provider !== 'mock' && res.url) refImage = res.url;

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

      views.push({ angle, url, provider });
    }

    if (realCount > 0) {
      await this.credits.consume(userId, AI_CREDIT_COSTS.tryon);
    }

    return { productName: product.name, views };
  }

  /** Génère un avatar personnalisé à partir de paramètres (création manuelle). */
  async generateAvatar(userId: string, input: GenerateAvatarInput) {
    const shop = await this.shopService.requireOwnedShop(userId);
    if (this.imageProvider.enabled) await this.credits.ensure(userId, AI_CREDIT_COSTS.image);

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

    if (provider !== 'mock') await this.credits.consume(userId, AI_CREDIT_COSTS.image);

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
    if (this.imageProvider.enabled) await this.credits.ensure(userId, AI_CREDIT_COSTS.campaign);

    // Visuel de base importé (photo produit, avatar/mannequin généré, ou upload)
    let sourceImageUrl = input.sourceImageUrl;
    if (!sourceImageUrl && input.productId) {
      const product = await this.prisma.product.findUnique({ where: { id: input.productId } });
      if (product && product.shopId === shop.id) sourceImageUrl = product.images[0];
    }

    const extra = input.details?.trim() ? `, ${input.details.trim()}` : '';
    // Visuel marketing : image→image si on a une base, sinon texte→image
    const imgPrompt = sourceImageUrl
      ? `Transforme cette image en visuel publicitaire mode premium pour "${input.productName}", ` +
        `style ${PhotoStyle.LUXE}, composition marketing pro, éclairage soigné, haute qualité, 8k${extra}, ` +
        `en conservant fidèlement le produit`
      : `Photo publicitaire mode, mannequin portant "${input.productName}", style ${PhotoStyle.LUXE}, ` +
        `composition marketing premium, haute qualité, 8k${extra}`;
    const image = sourceImageUrl
      ? await this.imageProvider.generateFromImage(imgPrompt, sourceImageUrl, 'Femme')
      : await this.imageProvider.generate(imgPrompt, 'Femme');
    if (image.provider !== 'mock') await this.credits.consume(userId, AI_CREDIT_COSTS.campaign);

    // Texte publicitaire (enrichi par les précisions du vendeur)
    const { result: copy, provider: textProvider } = await this.textProvider.generateAdCopy({
      productName: input.productName,
      category: input.category,
      tone: input.tone,
      details: input.details,
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
          fromImage: Boolean(sourceImageUrl),
          details: input.details ?? null,
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

  /** Supprime un contenu généré (uniquement s'il appartient à la boutique du vendeur). */
  async deleteAsset(userId: string, assetId: string) {
    const shop = await this.shopService.requireOwnedShop(userId);
    const asset = await this.prisma.generatedAsset.findFirst({
      where: { id: assetId, shopId: shop.id },
    });
    if (!asset) throw new NotFoundException('Contenu introuvable');
    await this.prisma.generatedAsset.delete({ where: { id: asset.id } });
    return { ok: true };
  }

  /** Purge tous les contenus simulés (provider « mock ») de la boutique — nettoyage des images de démo. */
  async deleteSimulatedAssets(userId: string) {
    const shop = await this.shopService.requireOwnedShop(userId);
    const { count } = await this.prisma.generatedAsset.deleteMany({
      where: { shopId: shop.id, provider: 'mock' },
    });
    return { ok: true, deleted: count };
  }
}
