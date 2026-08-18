/**
 * Calcul du montant d'un versement, dettes de remboursement déduites.
 *
 * Sans dépendance, comme les autres calculs monétaires : c'est ici que se
 * décide combien un vendeur reçoit réellement, et une erreur y est invisible
 * jusqu'à ce qu'il la conteste.
 */

export type Money = { toString(): string } | string | number | null | undefined;

export interface Debt {
  id: string;
  amount: Money;
}

export interface PayoutComputation {
  /** Montant à virer au vendeur. */
  amount: string;
  /** Dettes absorbées par ce versement. */
  settledDebtIds: string[];
  /** Dettes qui n'ont pas pu l'être et restent à récupérer. */
  carriedDebtIds: string[];
  /** Total encore dû par le vendeur après ce versement. */
  carriedAmount: string;
}

function toCents(value: Money): number {
  if (value === null || value === undefined) return 0;
  const n = Number(typeof value === 'object' ? value.toString() : value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function fromCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/**
 * Déduit les dettes une par une, tant que le versement reste positif.
 *
 * Une dette est absorbée **entièrement ou pas du tout**. Un règlement partiel
 * laisserait un remboursement à moitié compensé, impossible à expliquer au
 * vendeur comme à retrouver dans les comptes.
 *
 * Les dettes qui ne tiennent pas sont reportées sur le prochain versement.
 * Le montant versé ne peut jamais être négatif : on ne réclame pas d'argent
 * à un vendeur, on retient sur ce qu'on lui doit.
 */
export function computePayoutAmount(input: {
  eligibleTotal: Money;
  debts: Debt[];
}): PayoutComputation {
  let remaining = toCents(input.eligibleTotal);
  const settledDebtIds: string[] = [];
  const carriedDebtIds: string[] = [];
  let carried = 0;

  for (const debt of input.debts) {
    const cents = toCents(debt.amount);
    if (cents <= remaining) {
      remaining -= cents;
      settledDebtIds.push(debt.id);
    } else {
      carriedDebtIds.push(debt.id);
      carried += cents;
    }
  }

  return {
    amount: fromCents(remaining),
    settledDebtIds,
    carriedDebtIds,
    carriedAmount: fromCents(carried),
  };
}
