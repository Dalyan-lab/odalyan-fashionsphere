import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveShippingFee, normalizePlace } from './shipping-rules.ts';

/** Configuration type d'un vendeur ivoirien : Abidjan, puis le reste du pays. */
const abidjanPuisPays = {
  shippingFee: 3_000,
  freeShippingFrom: null,
  zones: [
    { name: 'Abidjan', cities: ['Abidjan'], countries: [], fee: 1_000 },
    { name: 'Côte d’Ivoire', cities: [], countries: ['CI'], fee: 2_500 },
  ],
};

describe('resolveShippingFee', () => {
  test('la première zone qui correspond l’emporte', () => {
    assert.equal(
      resolveShippingFee(abidjanPuisPays, 10_000, { city: 'Abidjan', country: 'CI' }),
      1_000,
      'un client abidjanais paie le tarif Abidjan, pas celui du pays',
    );
  });

  test('une ville non couverte retombe sur la zone pays', () => {
    assert.equal(resolveShippingFee(abidjanPuisPays, 10_000, { city: 'Bouaké', country: 'CI' }), 2_500);
  });

  test('une destination hors zones retombe sur le tarif de base', () => {
    assert.equal(resolveShippingFee(abidjanPuisPays, 10_000, { city: 'Dakar', country: 'SN' }), 3_000);
  });

  test('la casse et les accents n’empêchent pas la correspondance', () => {
    for (const ville of ['ABIDJAN', 'abidjan', '  Abidjan  ']) {
      assert.equal(
        resolveShippingFee(abidjanPuisPays, 10_000, { city: ville, country: 'CI' }),
        1_000,
        `« ${ville} » doit correspondre à la zone Abidjan`,
      );
    }
  });

  test('le seuil de gratuité l’emporte sur toutes les zones', () => {
    const config = { ...abidjanPuisPays, freeShippingFrom: 50_000 };
    assert.equal(resolveShippingFee(config, 50_000, { city: 'Abidjan', country: 'CI' }), 0);
    assert.equal(resolveShippingFee(config, 49_999, { city: 'Abidjan', country: 'CI' }), 1_000);
  });

  test('une zone sans ville ni pays attrape tout', () => {
    const config = {
      shippingFee: 9_999,
      freeShippingFrom: null,
      zones: [{ name: 'Partout', cities: [], countries: [], fee: 500 }],
    };
    assert.equal(resolveShippingFee(config, 1_000, { city: 'Tokyo', country: 'JP' }), 500);
  });

  test('une boutique sans réglage livre gratuitement', () => {
    const config = { shippingFee: null, freeShippingFrom: null, zones: [] };
    assert.equal(resolveShippingFee(config, 10_000, { city: 'Abidjan', country: 'CI' }), 0);
  });

  test('une destination inconnue ne fait pas correspondre une zone ciblée', () => {
    assert.equal(
      resolveShippingFee(abidjanPuisPays, 10_000, {}),
      3_000,
      'sans ville ni pays, seules les zones attrape-tout peuvent correspondre',
    );
  });

  test('accepte les montants sous forme de chaîne, comme les renvoie Prisma', () => {
    const config = {
      shippingFee: '3000',
      freeShippingFrom: '50000',
      zones: [{ name: 'Abidjan', cities: ['Abidjan'], countries: [], fee: '1000' }],
    };
    assert.equal(resolveShippingFee(config, '10000', { city: 'Abidjan' }), 1_000);
    assert.equal(resolveShippingFee(config, '50000', { city: 'Abidjan' }), 0);
  });
});

describe('normalizePlace', () => {
  test('retire accents, casse et espaces superflus', () => {
    assert.equal(normalizePlace('  CÔTE D’IVOIRE  '), 'cote d’ivoire');
    assert.equal(normalizePlace('Bouaké'), 'bouake');
  });
});
