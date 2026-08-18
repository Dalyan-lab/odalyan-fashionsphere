import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computePayoutAmount } from './payout-amount.ts';

describe('computePayoutAmount', () => {
  test('sans dette, le vendeur reçoit tout son solde', () => {
    const r = computePayoutAmount({ eligibleTotal: 50_000, debts: [] });
    assert.equal(r.amount, '50000.00');
    assert.deepEqual(r.settledDebtIds, []);
    assert.equal(r.carriedAmount, '0.00');
  });

  test('une dette est retenue sur le versement', () => {
    const r = computePayoutAmount({
      eligibleTotal: 50_000,
      debts: [{ id: 'r1', amount: 8_000 }],
    });
    assert.equal(r.amount, '42000.00');
    assert.deepEqual(r.settledDebtIds, ['r1']);
    assert.equal(r.carriedAmount, '0.00');
  });

  test('une dette trop grande est reportée, jamais versée en négatif', () => {
    const r = computePayoutAmount({
      eligibleTotal: 5_000,
      debts: [{ id: 'r1', amount: 8_000 }],
    });
    assert.equal(r.amount, '5000.00', 'le vendeur reçoit son solde intact');
    assert.deepEqual(r.settledDebtIds, [], 'la dette n’est pas absorbée');
    assert.deepEqual(r.carriedDebtIds, ['r1']);
    assert.equal(r.carriedAmount, '8000.00', 'elle reste due au prochain versement');
  });

  test('une dette est absorbée entièrement ou pas du tout', () => {
    // 10 000 disponibles, deux dettes de 6 000 : une seule peut passer.
    const r = computePayoutAmount({
      eligibleTotal: 10_000,
      debts: [
        { id: 'r1', amount: 6_000 },
        { id: 'r2', amount: 6_000 },
      ],
    });
    assert.equal(r.amount, '4000.00');
    assert.deepEqual(r.settledDebtIds, ['r1']);
    assert.deepEqual(r.carriedDebtIds, ['r2'], 'pas de règlement partiel');
  });

  test('une dette plus petite passe même si une plus grosse a été reportée', () => {
    const r = computePayoutAmount({
      eligibleTotal: 10_000,
      debts: [
        { id: 'grosse', amount: 12_000 },
        { id: 'petite', amount: 3_000 },
      ],
    });
    assert.equal(r.amount, '7000.00');
    assert.deepEqual(r.settledDebtIds, ['petite']);
    assert.deepEqual(r.carriedDebtIds, ['grosse']);
  });

  test('une dette égale au solde le ramène exactement à zéro', () => {
    const r = computePayoutAmount({
      eligibleTotal: 8_000,
      debts: [{ id: 'r1', amount: 8_000 }],
    });
    assert.equal(r.amount, '0.00');
    assert.deepEqual(r.settledDebtIds, ['r1']);
  });

  test('accepte les montants sous forme de chaîne, comme les renvoie Prisma', () => {
    const r = computePayoutAmount({
      eligibleTotal: '7078.50',
      debts: [{ id: 'r1', amount: '1078.50' }],
    });
    assert.equal(r.amount, '6000.00');
  });

  test('un solde nul ne verse rien et reporte toutes les dettes', () => {
    const r = computePayoutAmount({
      eligibleTotal: 0,
      debts: [{ id: 'r1', amount: 500 }],
    });
    assert.equal(r.amount, '0.00');
    assert.deepEqual(r.carriedDebtIds, ['r1']);
  });
});
