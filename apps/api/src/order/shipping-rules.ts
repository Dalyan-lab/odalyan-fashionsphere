/**
 * Résolution du tarif de livraison d'une boutique.
 *
 * Sans dépendance, pour la même raison que la répartition des encaissements :
 * un tarif mal résolu se facture au client ou se retire au vendeur, et cela
 * doit être vérifiable sans base de données.
 */

export interface ShippingZone {
  name: string;
  /** Villes couvertes. Liste vide = toutes. */
  cities: string[];
  /** Pays couverts. Liste vide = tous. */
  countries: string[];
  fee: { toString(): string } | string | number;
}

export interface ShippingConfig {
  /** Tarif appliqué quand aucune zone ne correspond. `null` = livraison offerte. */
  shippingFee?: { toString(): string } | string | number | null;
  /** Montant d'articles à partir duquel la livraison est offerte. */
  freeShippingFrom?: { toString(): string } | string | number | null;
  /** Zones, dans l'ordre d'évaluation : la première qui correspond l'emporte. */
  zones: ShippingZone[];
}

export interface Destination {
  city?: string | null;
  country?: string | null;
}

function amount(value: { toString(): string } | string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = Number(typeof value === 'object' ? value.toString() : value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Normalise un libellé de lieu pour la comparaison.
 *
 * Les acheteurs écrivent « ABIDJAN », « abidjan » ou « Abidjan  » ; les
 * vendeurs saisissent leurs zones tout aussi librement. Sans normalisation,
 * un tarif configuré ne s'appliquerait qu'à l'orthographe exacte du vendeur —
 * et le client paierait le tarif général sans que personne ne comprenne
 * pourquoi.
 */
export function normalizePlace(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Tarif applicable, dans l'ordre de priorité :
 *
 * 1. Le **seuil de gratuité** l'emporte sur tout : au-delà, la livraison est
 *    offerte quelle que soit la destination.
 * 2. La **première zone qui correspond** gagne — c'est ce qui permet d'écrire
 *    « Abidjan » avant « Côte d'Ivoire » sans ambiguïté.
 * 3. À défaut, le **tarif de base**, et zéro si la boutique n'en a pas.
 */
export function resolveShippingFee(
  config: ShippingConfig,
  subtotal: { toString(): string } | string | number,
  to: Destination,
): number {
  const free = amount(config.freeShippingFrom);
  if (free > 0 && amount(subtotal) >= free) return 0;

  const city = to.city ? normalizePlace(to.city) : null;
  const country = to.country ? normalizePlace(to.country) : null;

  for (const zone of config.zones) {
    // Liste vide = « toutes » : une zone sans ville ni pays est un attrape-tout,
    // volontairement placé en dernière position.
    const cityOk =
      zone.cities.length === 0 ||
      (city !== null && zone.cities.some((c) => normalizePlace(c) === city));
    const countryOk =
      zone.countries.length === 0 ||
      (country !== null && zone.countries.some((c) => normalizePlace(c) === country));
    if (cityOk && countryOk) return amount(zone.fee);
  }

  return amount(config.shippingFee);
}
