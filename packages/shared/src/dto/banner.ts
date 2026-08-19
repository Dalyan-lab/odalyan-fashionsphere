import { z } from 'zod';

/**
 * Bandeau de tête de la marketplace.
 *
 * Piloté depuis l'administration, jamais codé dans la page : une opération
 * commerciale se décide la veille pour le lendemain, et lancer des soldes ne
 * doit pas demander un redéploiement.
 */

/** Ton de la pastille — il décide de la couleur et de l'insistance. */
export const BANNER_TONES = ['PROMO', 'NEW', 'ALERT', 'INFO'] as const;
export type BannerTone = (typeof BANNER_TONES)[number];

/** Ambiances, pour habiller le bandeau même sans média. */
export const BANNER_THEMES = ['violet', 'or', 'nuit', 'ete', 'fete'] as const;
export type BannerTheme = (typeof BANNER_THEMES)[number];

export const BANNER_TONE_LABELS: Record<BannerTone, string> = {
  PROMO: 'Promotion',
  NEW: 'Nouveauté',
  ALERT: 'Dernière chance',
  INFO: 'Information',
};

export const BANNER_THEME_LABELS: Record<BannerTheme, string> = {
  violet: 'Violet (identité)',
  or: 'Or (luxe)',
  nuit: 'Nuit (sobre)',
  ete: 'Été (chaleur)',
  fete: 'Fête (fin d’année)',
};

/** Une URL, ou la chaîne vide pour retirer le média. */
const urlOuVide = z.string().url().or(z.literal('')).optional();
/** Date ISO, ou vide pour « pas de borne ». */
const dateOuVide = z.string().datetime().or(z.literal('')).nullable().optional();

const bannerFields = z.object({
  title: z.string().min(2, 'Un titre est requis').max(90),
  subtitle: z.string().max(180).optional(),
  badge: z.string().max(24).optional(),
  tone: z.enum(BANNER_TONES).optional(),
  ctaLabel: z.string().max(32).optional(),
  // Lien interne (« /marketplace?category=… ») ou adresse complète : les deux
  // sont légitimes, on refuse seulement ce qui n'est ni l'un ni l'autre.
  ctaUrl: z
    .string()
    .max(300)
    .refine((v) => v === '' || v.startsWith('/') || /^https?:\/\//.test(v), {
      message: 'Lien invalide : commencez par « / » ou par « https:// »',
    })
    .optional(),
  imageUrl: urlOuVide,
  videoUrl: urlOuVide,
  theme: z.enum(BANNER_THEMES).optional(),
  active: z.boolean().optional(),
  startsAt: dateOuVide,
  endsAt: dateOuVide,
  priority: z.number().int().min(0).max(1000).optional(),
});

/**
 * Une fenêtre qui se termine avant de commencer ne diffuserait jamais rien.
 * On refuse la saisie plutôt que de laisser croire à une campagne programmée.
 */
const fenetreCoherente = (
  v: { startsAt?: string | null; endsAt?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (v.startsAt && v.endsAt && new Date(v.startsAt) >= new Date(v.endsAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endsAt'],
      message: 'La fin doit être postérieure au début.',
    });
  }
};

export const createBannerSchema = bannerFields.superRefine(fenetreCoherente);
export const updateBannerSchema = bannerFields.partial().superRefine(fenetreCoherente);

export type CreateBannerInput = z.infer<typeof createBannerSchema>;
export type UpdateBannerInput = z.infer<typeof updateBannerSchema>;

export interface MarketplaceBannerInfo {
  id: string;
  title: string;
  subtitle: string | null;
  badge: string | null;
  tone: BannerTone;
  ctaLabel: string | null;
  ctaUrl: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  theme: BannerTheme;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
}

/**
 * Un bandeau est-il diffusé à cet instant ?
 *
 * Placée ici et non recopiée dans chaque écran : la même règle sert à
 * l'administration pour signaler ce qui est « à l'antenne », et le serveur la
 * transpose en SQL pour choisir le bandeau à servir. Deux copies finiraient par
 * diverger, et l'administration mentirait alors sur ce que voient les clients.
 *
 * Bornes nulles = pas de limite : un bandeau sans dates est permanent, tant
 * qu'il reste actif.
 */
export function isBannerLive(
  banner: Pick<MarketplaceBannerInfo, 'active' | 'startsAt' | 'endsAt'>,
  now: Date = new Date(),
): boolean {
  if (!banner.active) return false;
  const t = now.getTime();
  if (banner.startsAt && new Date(banner.startsAt).getTime() > t) return false;
  // La fin est exclusive : à la seconde d'échéance, la campagne est terminée.
  if (banner.endsAt && new Date(banner.endsAt).getTime() <= t) return false;
  return true;
}
