import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeOrderSplit } from './order-split.ts';

/** Compare un montant renvoyé par le calcul à la valeur attendue. */
function eq(actual: string, expected: string, message?: string) {
  assert.equal(actual, expected, message);
}

/** Somme de deux montants décimaux, en centimes, pour vérifier une répartition. */
function sum(a: string, b: string): string {
  const cents = Math.round(Number(a) * 100) + Math.round(Number(b) * 100);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

describe('computeOrderSplit', () => {
  test('la commission ne porte que sur les articles, pas sur la livraison', () => {
    // 10 000 F d'articles + 1 000 F de livraison, commission 10 %
    const s = computeOrderSplit({ total: 11_000, shipping: 1_000, rate: 0.1 });
    eq(s.commissionBase, '10000.00');
    eq(s.platformAmount, '1000.00', 'la plateforme prend 10 % des seuls articles');
    eq(s.sellerAmount, '10000.00', 'le vendeur garde 9 000 F + 1 000 F de livraison');
  });

  test('sans livraison, la commission porte sur tout', () => {
    const s = computeOrderSplit({ total: 10_000, rate: 0.1 });
    eq(s.platformAmount, '1000.00');
    eq(s.sellerAmount, '9000.00');
  });

  test('les deux parts redonnent toujours exactement le montant encaissé', () => {
    // Montants choisis pour produire un arrondi : 7 865 × 0,1 = 786,5
    for (const total of [7_865, 18_301, 6_553, 1, 3, 999_999]) {
      const s = computeOrderSplit({ total, rate: 0.1 });
      eq(
        sum(s.platformAmount, s.sellerAmount),
        `${total}.00`,
        `la somme des parts doit valoir ${total}`,
      );
    }
  });

  test('la commission est arrondie au centime, le vendeur reçoit le reste', () => {
    const s = computeOrderSplit({ total: 7_865, rate: 0.1 });
    eq(s.platformAmount, '786.50');
    eq(s.sellerAmount, '7078.50');
  });

  test('un taux nul laisse tout au vendeur', () => {
    const s = computeOrderSplit({ total: 10_000, shipping: 500, rate: 0 });
    eq(s.platformAmount, '0.00');
    eq(s.sellerAmount, '10000.00');
  });

  test('un taux aberrant est ramené à des bornes sûres', () => {
    // Un taux supérieur à 1 ferait payer le vendeur au lieu de le rémunérer.
    eq(computeOrderSplit({ total: 1_000, rate: 5 }).platformAmount, '1000.00');
    // Un taux négatif ou non numérique vaut zéro plutôt qu'une commission inversée.
    eq(computeOrderSplit({ total: 1_000, rate: -0.5 }).platformAmount, '0.00');
    eq(computeOrderSplit({ total: 1_000, rate: Number.NaN }).platformAmount, '0.00');
  });

  test('une livraison supérieure au total ne rend pas la commission négative', () => {
    const s = computeOrderSplit({ total: 500, shipping: 900, rate: 0.1 });
    eq(s.commissionBase, '0.00');
    eq(s.platformAmount, '0.00');
    eq(s.sellerAmount, '500.00', 'le vendeur ne peut pas recevoir plus que l’encaissement');
  });

  test('accepte les montants sous forme de chaîne, comme les renvoie Prisma', () => {
    const s = computeOrderSplit({ total: '11000', shipping: '1000', rate: 0.1 });
    eq(s.platformAmount, '1000.00');
    eq(s.sellerAmount, '10000.00');
  });

  test('des montants absents valent zéro plutôt que de casser le calcul', () => {
    const s = computeOrderSplit({ total: 1_000, shipping: null, rate: 0.1 });
    eq(s.platformAmount, '100.00');
  });
});
