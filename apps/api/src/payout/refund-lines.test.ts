import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeRefundLines, RefundLineError } from './refund-lines.ts';

/** Commande type : 3 chemises à 5 000, 1 pantalon à 12 000, 1 500 de livraison. */
const items = [
  { id: 'l1', quantity: 3, unitPrice: '5000.00' },
  { id: 'l2', quantity: 1, unitPrice: '12000.00' },
];

describe('computeRefundLines — montants', () => {
  test('une unité sur trois ne rembourse que cette unité', () => {
    const r = computeRefundLines({ items, lines: [{ orderItemId: 'l1', quantity: 1 }] });
    assert.equal(r.itemsAmount, '5000.00');
    assert.equal(r.amount, '5000.00');
    assert.equal(r.full, false);
  });

  test('la livraison n’est rendue que si tout est retourné', () => {
    const partiel = computeRefundLines({
      items,
      lines: [{ orderItemId: 'l1', quantity: 3 }],
      shipping: '1500.00',
    });
    assert.equal(partiel.shippingShare, '0.00', 'le client a bien été livré pour le reste');

    const tout = computeRefundLines({
      items,
      lines: [
        { orderItemId: 'l1', quantity: 3 },
        { orderItemId: 'l2', quantity: 1 },
      ],
      shipping: '1500.00',
    });
    assert.equal(tout.full, true);
    assert.equal(tout.shippingShare, '1500.00');
    assert.equal(tout.amount, '28500.00');
  });

  test('les deux parts redonnent exactement la somme rendue', () => {
    const r = computeRefundLines({
      items,
      lines: [{ orderItemId: 'l1', quantity: 1 }],
      rate: 0.1,
    });
    assert.equal(r.platformShare, '500.00');
    assert.equal(r.sellerShare, '4500.00');
    assert.equal(
      Number(r.sellerShare) + Number(r.platformShare),
      Number(r.amount),
      'aucun centime ne doit apparaître ni disparaître',
    );
  });

  test('la commission ne porte pas sur la livraison rendue', () => {
    const r = computeRefundLines({
      items: [{ id: 'l1', quantity: 1, unitPrice: '10000.00' }],
      lines: [{ orderItemId: 'l1', quantity: 1 }],
      shipping: '2000.00',
      rate: 0.1,
    });
    assert.equal(r.platformShare, '1000.00', '10 % des articles seulement');
    assert.equal(r.sellerShare, '11000.00', 'le vendeur reprend le transport à sa charge');
  });

  test('un taux aberrant est ramené dans des bornes sûres', () => {
    const r = computeRefundLines({
      items,
      lines: [{ orderItemId: 'l1', quantity: 1 }],
      rate: 4,
    });
    assert.equal(r.platformShare, '5000.00');
    assert.equal(r.sellerShare, '0.00', 'la reprise vendeur ne devient jamais négative');
  });

  test('un prix à virgule ne dérive pas', () => {
    const r = computeRefundLines({
      items: [{ id: 'l1', quantity: 3, unitPrice: '786.55' }],
      lines: [{ orderItemId: 'l1', quantity: 3 }],
    });
    assert.equal(r.itemsAmount, '2359.65');
  });
});

describe('computeRefundLines — ce qui doit être refusé', () => {
  test('une demande vide', () => {
    assert.throws(
      () => computeRefundLines({ items, lines: [] }),
      RefundLineError,
    );
  });

  test('un article étranger à la commande', () => {
    assert.throws(
      () => computeRefundLines({ items, lines: [{ orderItemId: 'inconnu', quantity: 1 }] }),
      /ne fait pas partie/i,
    );
  });

  test('une quantité nulle ou négative', () => {
    for (const quantity of [0, -2]) {
      assert.throws(
        () => computeRefundLines({ items, lines: [{ orderItemId: 'l1', quantity }] }),
        /au moins 1/i,
      );
    }
  });

  test('plus d’unités que la commande n’en contient', () => {
    assert.throws(
      () => computeRefundLines({ items, lines: [{ orderItemId: 'l1', quantity: 4 }] }),
      /3 unité/i,
    );
  });

  test('une unité déjà rendue ne peut pas l’être une seconde fois', () => {
    assert.throws(
      () =>
        computeRefundLines({
          items,
          alreadyRefunded: { l1: 3 },
          lines: [{ orderItemId: 'l1', quantity: 1 }],
        }),
      /déjà été entièrement remboursé/i,
      'c’est la garde qui empêche de vider une boutique par demandes successives',
    );
  });

  test('le reliquat tient compte des demandes déjà déposées', () => {
    const r = computeRefundLines({
      items,
      alreadyRefunded: { l1: 2 },
      lines: [{ orderItemId: 'l1', quantity: 1 }],
    });
    assert.equal(r.amount, '5000.00');
    assert.throws(
      () =>
        computeRefundLines({
          items,
          alreadyRefunded: { l1: 2 },
          lines: [{ orderItemId: 'l1', quantity: 2 }],
        }),
      /plus que 1 unité/i,
    );
  });

  test('le même article indiqué deux fois', () => {
    assert.throws(
      () =>
        computeRefundLines({
          items,
          lines: [
            { orderItemId: 'l1', quantity: 2 },
            { orderItemId: 'l1', quantity: 2 },
          ],
        }),
      /qu’une fois/i,
      'sans ce refus, deux lignes cumulées contourneraient le contrôle de quantité',
    );
  });
});

describe('computeRefundLines — solde de la commande', () => {
  test('un second remboursement qui rend le reste solde la commande', () => {
    const r = computeRefundLines({
      items,
      alreadyRefunded: { l1: 3 },
      lines: [{ orderItemId: 'l2', quantity: 1 }],
      shipping: '1500.00',
    });
    assert.equal(r.full, true, 'la commande est alors intégralement rendue');
    assert.equal(r.shippingShare, '1500.00', 'la livraison part sur le remboursement qui solde');
  });

  test('rendre tout un article n’en solde pas la commande pour autant', () => {
    const r = computeRefundLines({
      items,
      lines: [{ orderItemId: 'l2', quantity: 1 }],
      shipping: '1500.00',
    });
    assert.equal(r.full, false);
    assert.equal(r.shippingShare, '0.00');
  });
});
