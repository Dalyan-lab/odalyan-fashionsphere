/**
 * Calcul d'un remboursement partiel, article par article.
 *
 * Sans dépendance et en centimes entiers, comme les autres calculs monétaires
 * de la plateforme : voir `order-split.ts` pour le raisonnement.
 *
 * Le principe : le client ne saisit pas un montant, il désigne ce qu'il rend.
 * Le montant en découle. Laisser taper une somme libre ouvrirait la porte aux
 * erreurs de frappe et aux demandes dépassant ce qui a été payé ; partir des
 * lignes de commande rend le calcul vérifiable par les deux parties.
 */

export type Money = { toString(): string } | string | number | null | undefined;

/** Refus prévisible d'une demande — le service le traduit en 400. */
export class RefundLineError extends Error {}

export interface OrderLine {
  id: string;
  quantity: number;
  unitPrice: Money;
}

export interface RequestedLine {
  orderItemId: string;
  quantity: number;
}

export interface RefundComputation {
  lines: { orderItemId: string; quantity: number; amount: string }[];
  /** Total des articles rendus, hors livraison. */
  itemsAmount: string;
  /** Livraison rendue : tout ou rien, voir plus bas. */
  shippingShare: string;
  /** Somme rendue au client. */
  amount: string;
  /** Part reprise au vendeur. */
  sellerShare: string;
  /** Commission que la plateforme abandonne. */
  platformShare: string;
  /** Vrai quand ce remboursement solde la totalité de la commande. */
  full: boolean;
}

function toCents(value: Money): number {
  if (value === null || value === undefined) return 0;
  const n = Number(typeof value === 'object' ? value.toString() : value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function fromCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/**
 * Vérifie la demande et en déduit les montants.
 *
 * Trois règles y sont figées :
 *
 * 1. **On ne rend jamais deux fois la même unité.** `alreadyRefunded` porte les
 *    quantités déjà engagées, demandes en attente comprises : une demande en
 *    cours réserve ses unités, sinon deux demandes simultanées passeraient
 *    chacune le contrôle et rendraient l'article en double.
 * 2. **La livraison ne se découpe pas.** Elle n'est rendue que si la commande
 *    est intégralement retournée. Un client qui garde un article sur trois a
 *    bien été livré ; rembourser un tiers du transport ne correspondrait à
 *    aucune dépense réelle.
 * 3. **Le vendeur reprend le reste, pas un second arrondi.** Comme à
 *    l'encaissement, on arrondit la commission puis on soustrait, pour que les
 *    deux parts redonnent exactement la somme rendue au client.
 */
export function computeRefundLines(input: {
  items: OrderLine[];
  alreadyRefunded?: Record<string, number>;
  lines: RequestedLine[];
  shipping?: Money;
  rate?: number;
}): RefundComputation {
  const done = input.alreadyRefunded ?? {};
  if (input.lines.length === 0) {
    throw new RefundLineError('Indiquez au moins un article à rembourser.');
  }

  const seen = new Set<string>();
  const lines = input.lines.map((line) => {
    const item = input.items.find((i) => i.id === line.orderItemId);
    if (!item) throw new RefundLineError('Cet article ne fait pas partie de la commande.');
    if (seen.has(item.id)) {
      throw new RefundLineError('Un même article ne peut être indiqué qu’une fois.');
    }
    seen.add(item.id);

    const quantity = Math.trunc(Number(line.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new RefundLineError('La quantité à rembourser doit être d’au moins 1.');
    }
    const remaining = item.quantity - (done[item.id] ?? 0);
    if (quantity > remaining) {
      throw new RefundLineError(
        remaining > 0
          ? `Cet article n’a plus que ${remaining} unité(s) remboursable(s).`
          : 'Cet article a déjà été entièrement remboursé.',
      );
    }

    return {
      orderItemId: item.id,
      quantity,
      cents: toCents(item.unitPrice) * quantity,
    };
  });

  const itemsCents = lines.reduce((sum, l) => sum + l.cents, 0);

  // La commande est soldée si, une fois cette demande comptée, plus aucune
  // unité ne reste à rendre.
  const full = input.items.every((item) => {
    const asked = lines.find((l) => l.orderItemId === item.id)?.quantity ?? 0;
    return (done[item.id] ?? 0) + asked >= item.quantity;
  });

  const shippingCents = full ? Math.max(toCents(input.shipping), 0) : 0;
  const totalCents = itemsCents + shippingCents;

  const rate = Number.isFinite(input.rate) ? Math.min(Math.max(input.rate as number, 0), 1) : 0;
  // La commission n'a jamais porté sur la livraison : on ne la reprend donc
  // que sur les articles.
  const platformCents = Math.round(itemsCents * rate);

  return {
    lines: lines.map((l) => ({
      orderItemId: l.orderItemId,
      quantity: l.quantity,
      amount: fromCents(l.cents),
    })),
    itemsAmount: fromCents(itemsCents),
    shippingShare: fromCents(shippingCents),
    amount: fromCents(totalCents),
    sellerShare: fromCents(totalCents - platformCents),
    platformShare: fromCents(platformCents),
    full,
  };
}
