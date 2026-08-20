'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Icon } from '@/components/dashboard/icons';

/**
 * Panneaux Avatar, Essayage et Défilé du tableau de bord.
 *
 * Ils montraient jusqu'ici la **même image d'illustration répétée** — d'où les
 * trois vignettes identiques que voyait le vendeur. C'était une maquette, pas
 * une fonctionnalité : rien n'était branché sur ses créations.
 *
 * Ils affichent désormais ses vrais avatars et son dernier essayage, et l'on
 * peut agrandir n'importe quelle vue d'un clic. Aucune route nouvelle : les
 * essayages sont des `MANNEQUIN` marqués `kind: 'tryon'`, on les regroupe donc
 * par produit et l'on garde le plus récent.
 */

interface Asset {
  id: string;
  type: string;
  url: string | null;
  createdAt: string;
  productId?: string | null;
  meta?: { kind?: string; angle?: string; productId?: string } | null;
}

/** Vignette cliquable. La sélection se voit par un anneau, pas par un décalage. */
function Vignette({
  url,
  libelle,
  actif,
  ronde = false,
  onClick,
}: {
  url: string;
  libelle?: string;
  actif: boolean;
  ronde?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      title={libelle}
      className={`group overflow-hidden transition ${ronde ? 'rounded-full' : 'rounded-lg'} ${
        actif ? 'ring-2 ring-brand-violet' : 'ring-1 ring-border hover:ring-brand-violet/50'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={libelle ?? ''}
        className={`w-full object-cover transition group-hover:scale-105 ${ronde ? 'aspect-square' : 'aspect-[3/5]'}`}
      />
      {libelle && !ronde && (
        <span className="block bg-surface-2 py-0.5 text-center text-[9px] text-faint">{libelle}</span>
      )}
    </button>
  );
}

/** Invite affichée tant que rien n'a été créé — jamais une grille vide. */
function Vide({ texte, href, cta }: { texte: string; href: string; cta: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-4 py-5 text-center">
      <p className="text-xs text-muted">{texte}</p>
      <Link href={href} className="btn-primary mt-3 inline-block px-4 py-1.5 text-xs">
        {cta}
      </Link>
    </div>
  );
}

/** Charge des contenus générés d'un type donné. */
function useAssets(type: string) {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  useEffect(() => {
    apiFetch<Asset[]>(`/ai/assets?type=${type}`)
      .then((a) => setAssets(a.filter((x) => x.url)))
      .catch(() => setAssets([]));
  }, [type]);
  return assets;
}

/* ------------------------------------------------------------------ Avatar */

export function AvatarPanel() {
  const avatars = useAssets('AVATAR');
  const [choisi, setChoisi] = useState(0);

  if (avatars === null) return <p className="text-xs text-faint">Chargement…</p>;
  if (avatars.length === 0) {
    return (
      <Vide
        texte="Aucun avatar pour l’instant. Créez-en un pour essayer vos vêtements dessus."
        href="/dashboard/avatars"
        cta="Créer mon avatar"
      />
    );
  }

  const actif = avatars[Math.min(choisi, avatars.length - 1)]!;

  return (
    <div className="flex gap-3">
      <div className="min-w-0 flex-1">
        <div className="grid grid-cols-4 gap-1.5">
          {avatars.slice(0, 4).map((a, i) => (
            <Vignette
              key={a.id}
              url={a.url!}
              actif={i === choisi}
              ronde
              libelle={`Avatar ${i + 1}`}
              onClick={() => setChoisi(i)}
            />
          ))}
        </div>
        <Link
          href="/dashboard/avatars"
          className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-1.5 text-xs text-muted transition hover:border-brand-violet hover:text-content"
        >
          {Icon.plus({ width: 13, height: 13 })} Nouvel avatar
        </Link>
      </div>

      {/* Aperçu en grand de l'avatar choisi : c'est ce qui manquait, et c'est
          la seule façon de juger un visage sur une vignette de 40 pixels. */}
      <div className="w-24 shrink-0 overflow-hidden rounded-xl ring-1 ring-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={actif.url!} alt="Avatar sélectionné" className="aspect-[3/4] w-full object-cover" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------- Essayage / Défilé */

/** Vues du dernier essayage : le groupe de produit le plus récent. */
function useDernierEssayage() {
  const assets = useAssets('MANNEQUIN');
  return useMemo(() => {
    if (!assets) return null;
    const essais = assets.filter((a) => a.meta?.kind === 'tryon');
    if (essais.length === 0) return [];
    // Les contenus arrivent du plus récent au plus ancien : le produit du
    // premier est donc le dernier essayage réalisé.
    const produit = essais[0]!.meta?.productId ?? essais[0]!.productId ?? null;
    const duProduit = essais.filter((a) => (a.meta?.productId ?? a.productId ?? null) === produit);
    // Une seule vue par angle, la plus récente — sinon un ré-essayage
    // afficherait deux fois le même angle.
    const parAngle = new Map<string, Asset>();
    for (const a of duProduit) {
      const angle = a.meta?.angle ?? '—';
      if (!parAngle.has(angle)) parAngle.set(angle, a);
    }
    return [...parAngle.values()];
  }, [assets]);
}

export function TryonPanel() {
  const vues = useDernierEssayage();
  const [choisi, setChoisi] = useState(0);

  if (vues === null) return <p className="text-xs text-faint">Chargement…</p>;
  if (vues.length === 0) {
    return (
      <Vide
        texte="Aucun essayage pour l’instant. Habillez un avatar et retrouvez chaque angle ici."
        href="/dashboard/tryon"
        cta="Lancer un essayage"
      />
    );
  }

  const actif = vues[Math.min(choisi, vues.length - 1)]!;

  return (
    <>
      {/* La vue choisie en grand, au-dessus des angles : on juge une tenue en
          grand, on navigue en petit. */}
      <div className="mb-2 overflow-hidden rounded-xl ring-1 ring-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={actif.url!}
          alt={actif.meta?.angle ?? 'Essayage'}
          className="aspect-[4/3] w-full object-cover object-top"
        />
      </div>
      {/* Une colonne par vue : la grille suit le nombre d'angles au lieu de
          le supposer, sinon une vue supplémentaire passe à la ligne seule. */}
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${vues.length}, minmax(0, 1fr))` }}>
        {vues.map((v, i) => (
          <Vignette
            key={v.id}
            url={v.url!}
            libelle={v.meta?.angle}
            actif={i === choisi}
            onClick={() => setChoisi(i)}
          />
        ))}
      </div>
      <Link
        href="/dashboard/tryon"
        className="mt-3 block text-center text-[10px] text-brand-violet hover:underline"
      >
        Ouvrir l’essayage virtuel →
      </Link>
    </>
  );
}

export function RunwayPanel() {
  const vues = useDernierEssayage();
  const [index, setIndex] = useState(0);
  const [enLecture, setEnLecture] = useState(true);
  const minuteur = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enLecture || !vues || vues.length < 2) return;
    // Les navigateurs suspendent les minuteurs d'un onglet masqué : le défilé
    // reprendra au retour, et l'image affichée reste juste entre-temps.
    minuteur.current = setInterval(() => setIndex((i) => (i + 1) % vues.length), 1400);
    return () => {
      if (minuteur.current) clearInterval(minuteur.current);
    };
  }, [enLecture, vues]);

  if (vues === null) return <p className="text-xs text-faint">Chargement…</p>;
  if (vues.length === 0) {
    return (
      <Vide
        texte="Le défilé reprend les vues de votre essayage. Lancez-en un pour le voir tourner ici."
        href="/dashboard/defile"
        cta="Ouvrir le défilé"
      />
    );
  }

  const actif = vues[index % vues.length]!;

  return (
    <>
      <div className="relative overflow-hidden rounded-xl ring-1 ring-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={actif.url!}
          alt={actif.meta?.angle ?? ''}
          className="aspect-[4/3] w-full object-cover object-top"
        />
        <span className="absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-[10px] text-white">
          {actif.meta?.angle}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setEnLecture((v) => !v)}
          aria-label={enLecture ? 'Mettre en pause' : 'Lancer le défilé'}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-violet-magenta text-white"
        >
          {enLecture ? (
            <span className="text-[11px] font-bold">❚❚</span>
          ) : (
            Icon.play({ width: 14, height: 14 })
          )}
        </button>
        {/* Une barre par vue plutôt qu'une progression continue : elle dit
            combien d'angles existent et lequel on regarde. */}
        <div className="flex flex-1 gap-1">
          {vues.map((v, i) => (
            <button
              key={v.id}
              type="button"
              aria-label={v.meta?.angle}
              onClick={() => {
                setIndex(i);
                setEnLecture(false);
              }}
              className={`h-1.5 flex-1 rounded-full transition ${
                i === index % vues.length ? 'bg-brand-violet-magenta' : 'bg-surface-2'
              }`}
            />
          ))}
        </div>
      </div>

      <Link
        href="/dashboard/defile"
        className="mt-3 block text-center text-[10px] text-brand-violet hover:underline"
      >
        Voir en plein écran →
      </Link>
    </>
  );
}
