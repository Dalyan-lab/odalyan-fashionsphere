import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isBannerLive } from '@odalyan/shared';

/**
 * La fenêtre de diffusion décide de ce que voit un visiteur. Une erreur ici
 * laisserait une promotion expirée à l'écran, ou masquerait une campagne
 * lancée — deux fautes commerciales.
 */

const LE = (iso: string) => new Date(iso);
const MIDI = LE('2026-12-25T12:00:00Z');

const bandeau = (over: Partial<Parameters<typeof isBannerLive>[0]> = {}) => ({
  active: true,
  startsAt: null,
  endsAt: null,
  ...over,
});

describe('isBannerLive — fenêtre de diffusion', () => {
  test('sans bornes, un bandeau actif est permanent', () => {
    assert.equal(isBannerLive(bandeau(), MIDI), true);
  });

  test('inactif ne passe jamais, même dans sa fenêtre', () => {
    assert.equal(
      isBannerLive(bandeau({ active: false, startsAt: '2026-12-01T00:00:00Z' }), MIDI),
      false,
      'le drapeau actif doit primer : c’est le bouton d’arrêt d’urgence',
    );
  });

  test('une campagne préparée à l’avance reste invisible', () => {
    assert.equal(isBannerLive(bandeau({ startsAt: '2026-12-26T00:00:00Z' }), MIDI), false);
  });

  test('elle apparaît une fois l’heure de début passée', () => {
    assert.equal(isBannerLive(bandeau({ startsAt: '2026-12-25T11:59:00Z' }), MIDI), true);
  });

  test('une campagne terminée disparaît', () => {
    assert.equal(isBannerLive(bandeau({ endsAt: '2026-12-25T11:59:00Z' }), MIDI), false);
  });

  test('la fin est exclusive : à la seconde d’échéance, c’est fini', () => {
    assert.equal(
      isBannerLive(bandeau({ endsAt: '2026-12-25T12:00:00Z' }), MIDI),
      false,
      'sinon une promotion « jusqu’à midi » s’affiche encore à midi pile',
    );
  });

  test('le début est inclusif : à l’heure dite, la campagne est lancée', () => {
    assert.equal(isBannerLive(bandeau({ startsAt: '2026-12-25T12:00:00Z' }), MIDI), true);
  });

  test('les deux bornes encadrent bien la diffusion', () => {
    const fenetre = { startsAt: '2026-12-20T00:00:00Z', endsAt: '2026-12-31T23:59:00Z' };
    assert.equal(isBannerLive(bandeau(fenetre), MIDI), true);
    assert.equal(isBannerLive(bandeau(fenetre), LE('2026-12-19T23:00:00Z')), false);
    assert.equal(isBannerLive(bandeau(fenetre), LE('2027-01-01T00:00:00Z')), false);
  });
});
