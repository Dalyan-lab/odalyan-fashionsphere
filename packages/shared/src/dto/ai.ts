import { z } from 'zod';

export enum MannequinType {
  FEMME = 'Femme',
  HOMME = 'Homme',
  ENFANT = 'Enfant',
  GRANDE_TAILLE = 'Grande taille',
  SPORTIF = 'Sportif',
  LUXE = 'Luxe',
}

export enum PhotoStyle {
  STUDIO = 'Studio',
  EXTERIEUR = 'Extérieur',
  RUE = 'Rue',
  LIFESTYLE = 'Lifestyle',
  LUXE = 'Luxe',
}

export enum AdTone {
  LUXE = 'Luxe',
  JEUNE = 'Jeune & dynamique',
  PRO = 'Professionnel',
  AFRO = 'Afro-chic',
}

export enum AvatarSex {
  FEMME = 'Femme',
  HOMME = 'Homme',
  ENFANT = 'Enfant',
}

export enum BodyType {
  MINCE = 'Mince',
  NORMALE = 'Normale',
  ATHLETIQUE = 'Athlétique',
  GRANDE_TAILLE = 'Grande taille',
}

export enum SkinTone {
  CLAIR = 'Clair',
  METISSE = 'Métisse',
  MAT = 'Mat',
  FONCE = 'Foncé',
}

export const generateAvatarSchema = z.object({
  sex: z.nativeEnum(AvatarSex).default(AvatarSex.FEMME),
  bodyType: z.nativeEnum(BodyType).default(BodyType.NORMALE),
  skinTone: z.nativeEnum(SkinTone).default(SkinTone.METISSE),
  hairstyle: z.string().max(80).optional(),
  prompt: z.string().max(500).optional(),
  /** URL d'une photo importée pour générer un avatar ressemblant. */
  sourceImageUrl: z.string().url().optional(),
});

export type GenerateAvatarInput = z.infer<typeof generateAvatarSchema>;

/**
 * Décors du studio photo produit. L'essayage et le défilé n'ayant aucun sens
 * hors de la mode, c'est ce studio qui donne aux autres rayons leur équivalent :
 * transformer une photo prise au téléphone en visuel de vente.
 */
export enum ProductScene {
  FOND_BLANC = 'FOND_BLANC',
  MARBRE = 'MARBRE',
  BOIS = 'BOIS',
  CUISINE = 'CUISINE',
  SALON = 'SALON',
  BUREAU = 'BUREAU',
  EXTERIEUR = 'EXTERIEUR',
  LIFESTYLE = 'LIFESTYLE',
}

export const PRODUCT_SCENE_LABELS: Record<ProductScene, string> = {
  [ProductScene.FOND_BLANC]: 'Fond blanc (fiche produit)',
  [ProductScene.MARBRE]: 'Plan de travail en marbre',
  [ProductScene.BOIS]: 'Table en bois',
  [ProductScene.CUISINE]: 'Cuisine moderne',
  [ProductScene.SALON]: 'Salon lumineux',
  [ProductScene.BUREAU]: 'Bureau design',
  [ProductScene.EXTERIEUR]: 'Extérieur naturel',
  [ProductScene.LIFESTYLE]: 'Mise en situation',
};

/** Description du décor injectée dans le prompt de génération. */
export const PRODUCT_SCENE_PROMPTS: Record<ProductScene, string> = {
  [ProductScene.FOND_BLANC]:
    'sur un fond blanc parfaitement uni, ombre douce portée, cadrage centré type fiche produit e-commerce',
  [ProductScene.MARBRE]:
    'posé sur un plan de travail en marbre blanc veiné, lumière latérale douce, quelques reflets subtils',
  [ProductScene.BOIS]:
    'posé sur une table en bois clair, ambiance chaleureuse et naturelle, lumière du jour rasante',
  [ProductScene.CUISINE]:
    'mis en situation dans une cuisine moderne épurée, arrière-plan légèrement flou, lumière naturelle',
  [ProductScene.SALON]:
    'mis en situation dans un salon lumineux et élégant, arrière-plan légèrement flou, ambiance chaleureuse',
  [ProductScene.BUREAU]:
    'posé sur un bureau design minimaliste, ambiance technologique, éclairage doux et contrasté',
  [ProductScene.EXTERIEUR]:
    'en extérieur dans un cadre naturel, lumière du soleil de fin de journée, arrière-plan flou',
  [ProductScene.LIFESTYLE]:
    'en situation d’usage réel, ambiance de vie authentique, arrière-plan flou, lumière naturelle',
};

export const generateProductShotSchema = z.object({
  /** Produit du catalogue : sa photo sert de base et son nom nourrit le prompt. */
  productId: z.string().optional(),
  /** Nom libre quand aucun produit du catalogue n'est choisi. */
  productName: z.string().max(140).optional(),
  scene: z.nativeEnum(ProductScene).default(ProductScene.FOND_BLANC),
  /** Photo de départ ; à défaut, celle du produit choisi. */
  sourceImageUrl: z.string().url().optional(),
  /** Consigne libre qui remplace entièrement le prompt calculé. */
  prompt: z.string().max(600).optional(),
});

export type GenerateProductShotInput = z.infer<typeof generateProductShotSchema>;

export const generateMannequinSchema = z.object({
  productId: z.string().optional(),
  prompt: z.string().max(500).optional(),
  mannequinType: z.nativeEnum(MannequinType).default(MannequinType.FEMME),
  style: z.nativeEnum(PhotoStyle).default(PhotoStyle.STUDIO),
  /** Photo produit importée du catalogue : génère en image→image (vêtement réel porté). */
  sourceImageUrl: z.string().url().optional(),
  /** Avatar à habiller : quand présent, l'avatar devient la base et est habillé du produit. */
  avatarAssetId: z.string().optional(),
  /** Type de vêtement pour l'essayage 2-images (idm-vton) : haut / bas / robe. */
  garmentCategory: z.enum(['upper_body', 'lower_body', 'dresses']).optional(),
});

/**
 * Vues produites par un essayage, dans l'ordre d'une rotation du mannequin.
 *
 * Cinq plutôt que quatre : les deux trois-quarts sont les vues qui vendent un
 * vêtement — elles montrent la coupe et le tombé, là où la face et le dos
 * l'aplatissent.
 *
 * Les anciens essayages portent « Côté gauche » et « Côté droit ». Ces
 * libellés ne figurent plus ici mais restent affichés : `getLastTryOn` ajoute
 * à la suite tout angle inconnu de cette liste, sans quoi les essayages déjà
 * réalisés disparaîtraient de l'écran.
 */
export const TRYON_ANGLES = ['Face', '45° gauche', 'Profil', 'Dos', '45° droite'] as const;

export const TRYON_SIZES = ['S', 'M', 'L', 'XL', 'XXL'] as const;

export const generateTryOnSchema = z.object({
  productId: z.string().min(1, 'Produit requis'),
  /** Type de mannequin : Femme / Homme / Enfant. */
  avatarSex: z.nativeEnum(AvatarSex).default(AvatarSex.FEMME),
  /** Forme / morphologie du mannequin (mince, normale, athlétique, grande taille). */
  bodyType: z.nativeEnum(BodyType).default(BodyType.NORMALE),
  /** Taille du vêtement (S→XXL) : influence la corpulence rendue. */
  size: z.enum(TRYON_SIZES).optional(),
  /** Teint (optionnel, plus mis en avant dans l'UI d'essayage). */
  skinTone: z.nativeEnum(SkinTone).optional(),
  prompt: z.string().max(300).optional(),
  /** Avatar du vendeur (optionnel) : reprend son sexe/teint/coiffure. */
  avatarAssetId: z.string().optional(),
});

export type GenerateTryOnInput = z.infer<typeof generateTryOnSchema>;

export interface TryOnView {
  angle: string;
  url: string;
  provider: string;
}

export interface TryOnResult {
  productName: string;
  views: TryOnView[];
}

export const generateVideoSchema = z.object({
  providerId: z.string().default('mock'),
  productId: z.string().optional(),
  productName: z.string().max(140).optional(),
  imageUrl: z.string().url().optional(), // image source (image→vidéo)
  prompt: z.string().max(1500).optional(), // description du mouvement / scène
  script: z.string().max(1500).optional(), // texte parlé (avatar)
  tone: z.nativeEnum(AdTone).default(AdTone.LUXE),
  language: z.string().min(2).max(10).default('fr'),
  model: z.string().optional(),
  ratio: z.string().optional(),
  duration: z.coerce.number().int().min(2).max(20).optional(),
});

export type GenerateVideoInput = z.infer<typeof generateVideoSchema>;

/** Ajout d'une voix off publicitaire (TTS) sur une vidéo existante. */
export const addVoiceoverSchema = z.object({
  script: z.string().max(800).optional(),
  language: z.string().min(2).max(10).default('fr'),
  voice: z.string().max(60).optional(),
  /** Ajoute une musique de fond (MusicGen) atténuée sous la voix. */
  music: z.boolean().optional(),
  /** Ambiance de la musique de fond (ex. « afro-chic », « luxe calme »). */
  musicPrompt: z.string().max(200).optional(),
});

export type AddVoiceoverInput = z.infer<typeof addVoiceoverSchema>;

/** Option configurable d'un fournisseur vidéo (modèle, durée, ratio…). */
export interface VideoProviderOption {
  key: string;
  label: string;
  values: { value: string; label: string }[];
  default?: string;
}

export interface VideoProviderInfo {
  id: string;
  label: string;
  description: string;
  kind: 'avatar' | 'video';
  enabled: boolean;
  needs: ('product' | 'image' | 'script' | 'prompt')[];
  options: VideoProviderOption[];
}

export interface VideoAsset {
  id: string;
  status: string; // PENDING | READY | FAILED
  provider: string;
  url?: string | null;
  meta?: {
    kind?: string;
    script?: string | null;
    language?: string;
    imageUrl?: string | null;
    selectedProvider?: string;
    model?: string | null;
    ratio?: string | null;
    duration?: number | null;
  } | null;
  createdAt: string;
}

export const generateAdCopySchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(2, 'Nom du produit requis').max(140),
  category: z.string().optional(),
  tone: z.nativeEnum(AdTone).default(AdTone.LUXE),
  /** Précisions du vendeur (points forts, cible, promo…) pour un texte plus pertinent. */
  details: z.string().max(600).optional(),
});

export type GenerateMannequinInput = z.infer<typeof generateMannequinSchema>;
export type GenerateAdCopyInput = z.infer<typeof generateAdCopySchema>;

export interface AdCopyResult {
  description: string;
  slogans: string[];
  hashtags: string[];
  cta: string;
}

export enum SocialNetwork {
  FACEBOOK = 'Facebook',
  INSTAGRAM = 'Instagram',
  TIKTOK = 'TikTok',
  YOUTUBE = 'YouTube',
  PINTEREST = 'Pinterest',
  LINKEDIN = 'LinkedIn',
}

export const generateCampaignSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(2, 'Nom du produit requis').max(140),
  category: z.string().optional(),
  tone: z.nativeEnum(AdTone).default(AdTone.LUXE),
  networks: z
    .array(z.nativeEnum(SocialNetwork))
    .default([SocialNetwork.FACEBOOK, SocialNetwork.INSTAGRAM, SocialNetwork.TIKTOK]),
  /** Visuel de base importé (photo produit, avatar/mannequin généré, ou upload) → image→image. */
  sourceImageUrl: z.string().url().optional(),
  /** Précisions du vendeur pour un visuel + texte plus pertinents et pros. */
  details: z.string().max(600).optional(),
});

export type GenerateCampaignInput = z.infer<typeof generateCampaignSchema>;

export interface CampaignNetworkPost {
  network: string;
  caption: string;
}

export interface CampaignResult {
  id: string;
  productName: string;
  imageUrl?: string | null;
  copy: AdCopyResult;
  posts: CampaignNetworkPost[];
  providers: { image: string; text: string };
  createdAt: string;
}

export interface GeneratedAssetDto {
  id: string;
  type: string;
  status: string;
  provider: string;
  prompt?: string | null;
  url?: string | null;
  meta?: unknown;
  productId?: string | null;
  createdAt: string;
}
