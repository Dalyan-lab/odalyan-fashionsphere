/**
 * Répartition d'un encaissement entre la plateforme et le vendeur.
 *
 * Volontairement sans dépendance — ni Prisma, ni bibliothèque décimale. C'est
 * le calcul le plus sensible de la plateforme : une erreur ici se traduit
 * directement en argent mal versé. Le garder pur le rend vérifiable sans base
 * de données et sans environnement particulier.
 *
 * Tout se calcule en **centimes entiers**. Les nombres à virgule flottante
 * accumulent des écarts sur les multiplications monétaires ; l'arithmétique
 * entière n'en produit aucun.
 */

export type Money = { toString(): string } | string | number | null | undefined;

export interface OrderSplit {
  /** Montant sur lequel la commission est calculée (total moins la livraison). */
  commissionBase: string;
  /** Part de la plateforme. */
  platformAmount: string;
  /** Part du vendeur, livraison comprise. */
  sellerAmount: string;
}

/** Convertit un montant en centimes entiers. */
function toCents(value: Money): number {
  if (value === null || value === undefined) return 0;
  const n = Number(typeof value === 'object' ? value.toString() : value);
  if (!Number.isFinite(n)) return 0;
  // L'arrondi absorbe l'imprécision de la multiplication : 786.5 * 100 peut
  // valoir 78649.999… selon la représentation binaire du nombre.
  return Math.round(n * 100);
}

/** Reformate des centimes en montant décimal, toujours à deux décimales. */
function fromCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/**
 * Deux règles y sont figées :
 *
 * 1. **La livraison échappe à la commission.** C'est le vendeur qui paie le
 *    transport ; lui en prélever une part reviendrait à le taxer sur une
 *    dépense.
 * 2. **Le vendeur reçoit le reste, pas un second arrondi.** On arrondit la
 *    commission puis on soustrait, de sorte que les deux parts redonnent
 *    toujours exactement le montant encaissé — jamais un centime de plus
 *    ou de moins.
 */
export function computeOrderSplit(input: {
  total: Money;
  shipping?: Money;
  rate: number;
}): OrderSplit {
  const totalCents = toCents(input.total);
  const shippingCents = toCents(input.shipping);

  // Une livraison supérieure au total n'a pas de sens, mais si elle survient
  // (donnée incohérente) la base ne doit pas devenir négative : la commission
  // serait alors négative et le vendeur recevrait plus que l'encaissement.
  const baseCents = Math.max(totalCents - shippingCents, 0);

  // Un taux hors de [0, 1] ferait payer le vendeur ou lui verserait plus que
  // l'encaissement. On le ramène dans des bornes sûres plutôt que de propager
  // une valeur aberrante jusqu'aux versements.
  const rate = Number.isFinite(input.rate) ? Math.min(Math.max(input.rate, 0), 1) : 0;

  const platformCents = Math.round(baseCents * rate);
  const sellerCents = totalCents - platformCents;

  return {
    commissionBase: fromCents(baseCents),
    platformAmount: fromCents(platformCents),
    sellerAmount: fromCents(sellerCents),
  };
}
