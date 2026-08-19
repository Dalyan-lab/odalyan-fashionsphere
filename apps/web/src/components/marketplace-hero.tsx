'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { MarketplaceBannerInfo } from '@odalyan/shared';

/**
 * Bandeau de tête de la marketplace.
 *
 * C'est la première seconde de la visite : elle doit dire ce qui se passe
 * aujourd'hui dans la boutique, pas afficher une image de décoration. Le
 * contenu vient de la base, donc une opération commerciale se lance sans
 * redéploiement.
 *
 * Trois exigences qui gouvernent le rendu :
 *
 * 1. **Le texte reste lisible sur n'importe quel média.** Un voile dégradé est
 *    posé sous les mots. Sans lui, un titre blanc sur une photo claire devient
 *    illisible — et on ne maîtrise pas la photo qui sera choisie.
 * 2. **La vidéo est muette, en boucle et jouée sur place.** Une lecture avec le
 *    son est bloquée par les navigateurs et hostile pour le visiteur.
 * 3. **Rien ne bouge pour qui a désactivé les animations.** Le mouvement de
 *    caméra s'arrête, la vidéo laisse la place à son image fixe.
 */

/** Ambiances de fond, utilisées seules ou sous le média. */
const THEMES: Record<string, string> = {
  violet: 'linear-gradient(120deg,#4c1d95,#7c3aed 45%,#c0306a)',
  or: 'linear-gradient(120deg,#3b2a06,#a97a13 50%,#f0c14b)',
  nuit: 'linear-gradient(120deg,#0a0710,#1d1730 55%,#312a4d)',
  ete: 'linear-gradient(120deg,#b23a2f,#f4825e 50%,#f7c59f)',
  fete: 'linear-gradient(120deg,#5b0d1c,#a4133c 50%,#e0aa3e)',
};

/**
 * Couleur de la pastille selon son ton.
 *
 * Les tons ont un sens : `ALERT` prévient d'une fin proche, `PROMO` annonce une
 * remise. Seuls ces deux-là clignotent — une pastille qui pulse en permanence
 * cesse d'alerter.
 */
const TONS: Record<string, { fond: string; pulse: boolean }> = {
  PROMO: { fond: 'bg-brand-rose text-white', pulse: true },
  ALERT: { fond: 'bg-yellow-400 text-black', pulse: true },
  NEW: { fond: 'bg-emerald-400 text-black', pulse: false },
  INFO: { fond: 'bg-white/90 text-black', pulse: false },
};

/** Temps restant en clair, ou `null` si la fin est lointaine ou absente. */
function tempsRestant(endsAt: string | null): string | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  // Au-delà d'une semaine, un décompte n'a plus d'effet : il devient du bruit.
  if (ms <= 0 || ms > 7 * 24 * 3600_000) return null;
  const jours = Math.floor(ms / (24 * 3600_000));
  const heures = Math.floor((ms % (24 * 3600_000)) / 3600_000);
  const minutes = Math.floor((ms % 3600_000) / 60_000);
  if (jours > 0) return `${jours} j ${heures} h`;
  if (heures > 0) return `${heures} h ${minutes} min`;
  return `${minutes} min`;
}

function animationsReduites(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function MarketplaceHero({
  fallbackTitle,
  fallbackSubtitle,
}: {
  fallbackTitle: string;
  fallbackSubtitle: string;
}) {
  const [banner, setBanner] = useState<MarketplaceBannerInfo | null | undefined>(undefined);
  const [restant, setRestant] = useState<string | null>(null);
  const sobre = animationsReduites();

  useEffect(() => {
    apiFetch<MarketplaceBannerInfo | null>('/banners/current', { auth: false })
      .then(setBanner)
      .catch(() => setBanner(null));
  }, []);

  useEffect(() => {
    if (!banner?.endsAt) return;
    const rafraichir = () => setRestant(tempsRestant(banner.endsAt));
    rafraichir();
    // À la minute : un décompte à la seconde ferait travailler la page pour
    // un chiffre que personne ne fixe.
    const id = setInterval(rafraichir, 60_000);
    return () => clearInterval(id);
  }, [banner]);

  const fond = THEMES[banner?.theme ?? 'violet'] ?? THEMES.violet;
  const ton = TONS[banner?.tone ?? 'INFO'] ?? TONS.INFO;
  const titre = banner?.title ?? fallbackTitle;
  const sousTitre = banner?.subtitle ?? (banner ? null : fallbackSubtitle);

  return (
    <section
      className="relative isolate overflow-hidden rounded-3xl"
      style={{ background: fond }}
      aria-live="polite"
    >
      {/* Média de fond. La vidéo prime quand les deux sont fournies. */}
      {banner?.videoUrl && !sobre ? (
        <video
          key={banner.videoUrl}
          src={banner.videoUrl}
          poster={banner.imageUrl ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
      ) : banner?.imageUrl ? (
        <img
          src={banner.imageUrl}
          alt=""
          aria-hidden
          className={`absolute inset-0 h-full w-full object-cover opacity-60 ${
            sobre ? '' : 'animate-kenburns'
          }`}
        />
      ) : null}

      {/* Voile : c'est lui qui garantit la lisibilité du texte quelle que soit
          l'image choisie. Plus dense à gauche, où le texte est posé. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(10,7,16,0.86) 0%, rgba(10,7,16,0.62) 45%, rgba(10,7,16,0.25) 100%)',
        }}
        aria-hidden
      />

      <div className="relative px-7 py-12 sm:px-10 sm:py-16 lg:max-w-[62%]">
        {banner?.badge && (
          <span
            className={`inline-flex animate-reveal items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide opacity-0 motion-reduce:animate-none motion-reduce:opacity-100 ${ton.fond}`}
          >
            {ton.pulse && !sobre && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
              </span>
            )}
            {banner.badge}
          </span>
        )}

        <h1
          className="mt-3 animate-reveal font-display text-4xl font-bold leading-tight text-white opacity-0 drop-shadow-sm motion-reduce:animate-none motion-reduce:opacity-100 sm:text-5xl"
          style={{ animationDelay: '80ms' }}
        >
          {titre}
        </h1>

        {sousTitre && (
          <p
            className="mt-3 max-w-xl animate-reveal text-base text-white/85 opacity-0 motion-reduce:animate-none motion-reduce:opacity-100"
            style={{ animationDelay: '160ms' }}
          >
            {sousTitre}
          </p>
        )}

        <div
          className="mt-6 flex animate-reveal flex-wrap items-center gap-4 opacity-0 motion-reduce:animate-none motion-reduce:opacity-100"
          style={{ animationDelay: '240ms' }}
        >
          {banner?.ctaLabel && banner.ctaUrl && (
            <Link
              href={banner.ctaUrl}
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black transition-transform hover:scale-[1.03]"
            >
              {banner.ctaLabel}
            </Link>
          )}

          {restant && (
            // Le décompte n'apparaît qu'à moins d'une semaine de la fin : c'est
            // ce qui lui donne son sens.
            <span className="rounded-xl bg-black/35 px-3 py-2 text-sm text-white ring-1 ring-white/20">
              Plus que <strong className="tabular-nums">{restant}</strong>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
