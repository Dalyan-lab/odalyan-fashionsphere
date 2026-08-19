'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Chiffre qui monte jusqu'à sa valeur.
 *
 * Un tableau de bord qui affiche ses totaux figés ressemble à une capture
 * d'écran. Les voir monter dit que la plateforme a compté quelque chose —
 * c'est ce qui rassure, bien plus qu'une animation décorative.
 *
 * Trois précautions qui font toute la différence entre un effet soigné et un
 * effet agaçant :
 *
 * 1. **Le départ attend la donnée.** Les totaux arrivent d'un appel réseau.
 *    Animer dès le montage ferait monter un zéro, puis sauter à la vraie
 *    valeur — pire que pas d'animation du tout.
 * 2. **Un même total ne se rejoue pas.** Seul un changement de cible relance
 *    le compteur ; un rendu provoqué par autre chose ne le fait pas repartir.
 * 3. **La durée s'adapte.** Passer de 0 à 3 en une seconde paraît interminable,
 *    de 0 à 480 000 en une seconde paraît juste. On raccourcit les petits
 *    nombres.
 */

/** Décélération : le compteur ralentit en approchant, comme un compteur réel. */
export const adoucir = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Durée adaptée à l'ampleur du saut, entre 400 et 1100 ms.
 *
 * Passer de 0 à 3 en une seconde paraît interminable, de 0 à 480 000 en une
 * seconde paraît juste. Le logarithme rapproche ces deux ressentis.
 */
export const dureeAnimation = (ecart: number) =>
  Math.min(1100, Math.max(400, 260 + Math.log10(Math.abs(ecart) + 1) * 260));

function reduitLesAnimations(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function useCountUp(cible: number): number {
  const valide = Number.isFinite(cible) ? cible : 0;
  const [valeur, setValeur] = useState(valide);
  // Cible réellement animée, pour ne pas relancer sur un rendu sans changement.
  const derniere = useRef<number | null>(null);

  useEffect(() => {
    if (derniere.current === valide) return;
    const depart = derniere.current === null ? 0 : derniere.current;
    derniere.current = valide;

    // Rien à montrer, ou l'utilisateur a demandé moins d'animations.
    //
    // Le cas de l'onglet masqué mérite d'être dit : le navigateur y suspend
    // `requestAnimationFrame`. Sans ce garde-fou, un tableau de bord ouvert
    // dans un onglet d'arrière-plan resterait figé sur la valeur de départ —
    // il afficherait donc **zéro à la place du vrai total**, ce qui est bien
    // pire qu'une absence d'animation. On pose la valeur exacte tout de suite ;
    // l'effet se rejouera si la cible change une fois l'onglet revenu au premier
    // plan.
    if (valide === depart || reduitLesAnimations() || document.hidden) {
      setValeur(valide);
      return;
    }

    const duree = dureeAnimation(valide - depart);

    let image = 0;
    const debut = performance.now();
    const avancer = (maintenant: number) => {
      const t = Math.min(1, (maintenant - debut) / duree);
      setValeur(depart + (valide - depart) * adoucir(t));
      if (t < 1) image = requestAnimationFrame(avancer);
      // La valeur exacte est posée par la dernière image : un arrondi
      // intermédiaire ne doit jamais rester affiché à la place du total.
      else setValeur(valide);
    };
    image = requestAnimationFrame(avancer);
    return () => cancelAnimationFrame(image);
  }, [valide]);

  return valeur;
}

/**
 * `format` reçoit la valeur intermédiaire : c'est lui qui décide de l'affichage
 * (devise, pourcentage, entier). Le compteur ne suppose rien du format.
 */
export function CountUp({
  value,
  format,
  className = '',
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const courante = useCountUp(value);
  return (
    // `tabular-nums` fixe la largeur des chiffres. Sans lui, un 1 plus étroit
    // qu'un 8 fait trembler le nombre pendant toute la montée.
    <span className={`tabular-nums ${className}`}>
      {format ? format(courante) : Math.round(courante).toLocaleString('fr-FR')}
    </span>
  );
}
