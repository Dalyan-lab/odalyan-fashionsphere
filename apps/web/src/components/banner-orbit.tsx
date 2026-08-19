'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animation orbitale du bandeau, rendue nativement.
 *
 * Reprend l'idée de la maquette : les univers produits se détachent du visuel,
 * tournent autour d'un centre, se rangent en vitrine, puis reviennent. Mais
 * **sans passer par une vidéo**.
 *
 * Pourquoi pas une vidéo : un export MP4 coûte plusieurs mégaoctets, se
 * recadre mal dans un bandeau bien plus large que haut, se compresse, et
 * dépend d'une chaîne d'export sur laquelle on n'a aucune prise — c'est
 * précisément là que les vignettes s'étaient perdues. Ici, tout est calculé à
 * l'affichage : net à n'importe quelle taille, quelques kilooctets de code, et
 * une seule image à charger.
 *
 * Les vignettes sont des découpes de l'image du bandeau, exprimées en
 * fractions plutôt qu'en pixels : la même règle vaut donc pour n'importe quelle
 * bannière construite sur ce modèle — une rangée d'univers dans la moitié
 * haute — sans coordonnées codées en dur.
 */

/** Fenêtre des vignettes dans l'image, en fraction de sa largeur et hauteur. */
const DECOUPE = { x0: 0.005, x1: 0.758, y0: 0.14, y1: 0.795 };

/**
 * Part basse de l'image écartée de l'affichage.
 *
 * Les bandeaux de ce modèle se terminent par une barre de réassurance —
 * qualité, livraison, service client, paiement, retours. Utile sur une page
 * produit, hors sujet en tête de marketplace : elle y ajoute six mentions en
 * petits caractères qui volent l'attention au titre et au bouton, et que
 * personne ne lit à cet endroit. On garde donc la partie haute, celle qui
 * montre les univers et les visages.
 */
const BAS_ECARTE = 0.19;
/** Facteur d'agrandissement qui pousse la barre hors du cadre. */
const ZOOM = 1 / (1 - BAS_ECARTE);
const NB = 6;
const LARGEUR_VIGNETTE = (DECOUPE.x1 - DECOUPE.x0) / NB;
const HAUTEUR_VIGNETTE = DECOUPE.y1 - DECOUPE.y0;
/** Durée de la boucle. Le raccord est exact : l'état à 10 s égale celui à 0 s. */
export const BOUCLE = 10;

/** Interpolation sur une suite de points [temps, valeur], adoucie. */
export function courbe(t: number, points: [number, number][]): number {
  if (t <= points[0]![0]) return points[0]![1];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, va] = points[i]!;
    const [b, vb] = points[i + 1]!;
    if (t <= b) {
      const p = b === a ? 1 : (t - a) / (b - a);
      // Départ et arrivée sans à-coup : une interpolation linéaire donnerait
      // des ruptures visibles à chaque point de passage.
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      return va + (vb - va) * e;
    }
  }
  return points[points.length - 1]![1];
}

function animationsReduites(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function BannerOrbit({ imageUrl }: { imageUrl: string }) {
  const [t, setT] = useState(0);
  const boite = useRef<HTMLDivElement>(null);
  const [taille, setTaille] = useState({ w: 1200, h: 400 });

  // L'animation se cale sur la taille réelle du bandeau, qui change avec la
  // fenêtre et avec le réglage de hauteur.
  useEffect(() => {
    const el = boite.current;
    if (!el) return;
    const mesurer = () => setTaille({ w: el.clientWidth, h: el.clientHeight });
    mesurer();
    const ro = new ResizeObserver(mesurer);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    // Immobile pour qui a désactivé les animations. L'état de repos montre le
    // visuel entier, jamais un écran vide.
    if (animationsReduites()) return;
    let image = 0;
    const debut = performance.now();
    const avancer = (maintenant: number) => {
      setT(((maintenant - debut) / 1000) % BOUCLE);
      image = requestAnimationFrame(avancer);
    };
    image = requestAnimationFrame(avancer);
    return () => cancelAnimationFrame(image);
  }, []);

  const { w: W, h: H } = taille;

  // Le texte du bandeau occupe la gauche : le ballet se tient à droite, sinon
  // il se jouerait derrière les mots et ne se verrait pas.
  const cx = W * 0.7;
  const cy = H * 0.5;
  const rayonX = W * 0.2;
  const rayonY = H * 0.3;

  const hVignette = H * 0.46;
  const lVignette = hVignette * ((LARGEUR_VIGNETTE * 1536) / (HAUTEUR_VIGNETTE * 400));

  // L'image entière ouvre et referme la boucle.
  const opaciteFond = courbe(t, [[0, 1], [1.8, 1], [3, 0.12], [4.4, 0], [8.2, 0], [9.7, 1], [10, 1]]);

  return (
    <div ref={boite} className="absolute inset-0 overflow-hidden" aria-hidden>
      {/* Visuel d'ouverture et de fermeture, barre de réassurance exclue. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${imageUrl})`,
          // Hauteur agrandie et calage en haut : la bande basse sort du cadre.
          backgroundSize: `auto ${ZOOM * 100}%`,
          backgroundPosition: 'center top',
          backgroundRepeat: 'no-repeat',
          opacity: opaciteFond,
        }}
      />

      {Array.from({ length: NB }, (_, i) => {
        const fx = DECOUPE.x0 + i * LARGEUR_VIGNETTE;

        // Trois positions successives : en orbite, rangée en vitrine, puis
        // ramenée au centre. Les décalages par indice évitent que les six
        // bougent d'un seul bloc, ce qui ferait mécanique.
        const angle = (i / NB) * Math.PI * 2 + t * 0.34;
        const ox = cx + Math.cos(angle) * rayonX;
        const oy = cy + Math.sin(angle) * rayonY;

        const colonne = i % 3;
        const ligne = i < 3 ? 0 : 1;
        const gx = cx + (colonne - 1) * lVignette * 1.15;
        const gy = cy + (ligne - 0.5) * hVignette * 0.62;

        const depart = 1.8 + i * 0.09;
        const versGrille = 5.0 + i * 0.06;
        const retour = 8.0 + i * 0.05;

        const x = courbe(t, [[0, ox], [depart, ox], [depart + 1.1, ox], [versGrille, ox], [versGrille + 1.3, gx], [retour, gx], [retour + 1.0, cx], [10, cx]]);
        const y = courbe(t, [[0, oy], [depart, oy], [depart + 1.1, oy], [versGrille, oy], [versGrille + 1.3, gy], [retour, gy], [retour + 1.0, cy], [10, cy]]);
        const echelle = courbe(t, [[0, 1], [versGrille, 1], [versGrille + 1.3, 0.78], [retour, 0.78], [retour + 0.95, 0.06], [10, 0.06]]);
        const opacite = courbe(t, [[0, 0], [depart, 0], [depart + 0.6, 1], [retour + 0.5, 1], [retour + 0.95, 0], [10, 0]]);

        return (
          <div
            key={i}
            className="absolute rounded-xl"
            style={{
              width: lVignette,
              height: hVignette,
              left: x - lVignette / 2,
              top: y - hVignette / 2,
              transform: `scale(${echelle})`,
              opacity: opacite,
              // La découpe est exprimée en fractions : l'image est agrandie de
              // sorte que la fenêtre voulue remplisse exactement la vignette.
              backgroundImage: `url(${imageUrl})`,
              backgroundSize: `${lVignette / LARGEUR_VIGNETTE}px ${hVignette / HAUTEUR_VIGNETTE}px`,
              backgroundPosition: `${-fx * (lVignette / LARGEUR_VIGNETTE)}px ${-DECOUPE.y0 * (hVignette / HAUTEUR_VIGNETTE)}px`,
              boxShadow: '0 18px 34px rgba(0,0,0,0.55), inset 0 0 0 1.5px rgba(217,177,99,0.45)',
            }}
          />
        );
      })}

      {/* Halo central : donne un point de convergence au ballet. */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          width: Math.min(W, H) * 0.5,
          height: Math.min(W, H) * 0.5,
          left: cx - Math.min(W, H) * 0.25,
          top: cy - Math.min(W, H) * 0.25,
          background:
            'radial-gradient(closest-side, rgba(217,177,99,0.30), rgba(120,60,180,0.14) 55%, transparent 72%)',
          opacity: courbe(t, [[0, 0], [2.2, 0.6], [8.6, 0.8], [9.6, 0], [10, 0]]),
          filter: 'blur(12px)',
        }}
      />
    </div>
  );
}
