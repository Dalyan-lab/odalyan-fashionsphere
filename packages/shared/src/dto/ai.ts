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

export const generateMannequinSchema = z.object({
  productId: z.string().optional(),
  prompt: z.string().max(500).optional(),
  mannequinType: z.nativeEnum(MannequinType).default(MannequinType.FEMME),
  style: z.nativeEnum(PhotoStyle).default(PhotoStyle.STUDIO),
  /** Photo produit importée du catalogue : génère en image→image (vêtement réel porté). */
  sourceImageUrl: z.string().url().optional(),
});

export const TRYON_ANGLES = ['Face', '45° gauche', 'Profil', '45° droite', 'Dos'] as const;

export const generateTryOnSchema = z.object({
  productId: z.string().min(1, 'Produit requis'),
  avatarSex: z.nativeEnum(AvatarSex).default(AvatarSex.FEMME),
  skinTone: z.nativeEnum(SkinTone).default(SkinTone.METISSE),
  prompt: z.string().max(300).optional(),
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
  X = 'X',
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
