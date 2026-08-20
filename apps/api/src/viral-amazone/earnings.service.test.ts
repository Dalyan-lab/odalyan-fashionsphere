import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { EarningsService } from './earnings.service.ts';
import { makeFakePrisma, callsOf } from '../testing/fake-prisma.ts';

/**
 * Le registre des gains décide de ce qu'un créateur peut retirer. Deux fautes
 * y seraient graves : laisser retirer deux fois la même somme, et annoncer
 * comme versé de l'argent qui ne l'est pas encore.
 */

const SEUIL = 25_000;

function build(ecritures: Record<string, unknown>[], boutique: Record<string, unknown> = {}) {
  const prisma = makeFakePrisma({
    creatorEarning: ecritures,
    shop: [{ id: 'b1', ownerId: 'u1', creatorTier: 'BRONZE', payoutNumber: '0700000000', ...boutique }],
  });
  const shopService = {
    requireOwnedShop: async () => ({
      id: 'b1',
      creatorTier: 'BRONZE',
      payoutNumber: boutique.payoutNumber === null ? null : '0700000000',
      payoutOperator: 'Wave',
      payoutHolderName: 'Awa Diop',
      ...boutique,
    }),
  };
  return { service: new EarningsService(prisma as never, shopService as never), prisma };
}

const gain = (montant: number) => ({ shopId: 'b1', amount: montant, kind: 'affiliate', status: 'AVAILABLE' });
const retrait = (montant: number, statut = 'REQUESTED') => ({
  shopId: 'b1', amount: -montant, kind: 'withdrawal', status: statut,
});

describe('EarningsService — retrait des gains', () => {
  test('sous le seuil, le retrait est refusé et le montant manquant annoncé', async () => {
    const { service } = build([gain(10_000)]);
    await assert.rejects(() => service.requestWithdrawal('u1'), /25\s*000|25 000/);
  });

  test('sans coordonnées de reversement, le retrait est refusé avant tout calcul', async () => {
    const { service } = build([gain(90_000)], { payoutNumber: null });
    await assert.rejects(() => service.requestWithdrawal('u1'), /coordonnées/i);
  });

  test('le retrait enregistre une écriture négative du montant disponible', async () => {
    const { service, prisma } = build([gain(30_000)]);
    const res = await service.requestWithdrawal('u1');
    assert.equal(res.requested, 30_000);

    const create = callsOf(prisma).find((c) => c.model === 'creatorEarning' && c.method === 'create');
    const data = (create!.args as { data: Record<string, unknown> }).data;
    assert.equal(data.amount, -30_000, 'un retrait se soustrait, il ne se marque pas ailleurs');
    assert.equal(data.status, 'REQUESTED');
    assert.match(String(data.destination), /Wave/, 'les coordonnées sont figées sur la demande');
  });

  test('un retrait déjà demandé n’est pas retirable une seconde fois', async () => {
    // 30 000 gagnés, 30 000 déjà demandés : le disponible est nul.
    const { service } = build([gain(30_000), retrait(30_000)]);
    await assert.rejects(
      () => service.requestWithdrawal('u1'),
      /Vous en avez 0/,
      'sommer les seuls gains laisserait retirer deux fois la même somme',
    );
  });

  test('les gains d’origine ne sont jamais réécrits', async () => {
    const { service, prisma } = build([gain(40_000)]);
    await service.requestWithdrawal('u1');
    const maj = callsOf(prisma).find(
      (c) => c.model === 'creatorEarning' && (c.method === 'update' || c.method === 'updateMany'),
    );
    assert.equal(maj, undefined, 'l’historique des gains doit rester lisible tel quel');
  });
});

describe('EarningsService — crédit et versement', () => {
  test('un montant nul ou négatif est refusé', async () => {
    const { service } = build([]);
    for (const montant of [0, -500]) {
      await assert.rejects(() => service.credit('b1', montant), /positif/i);
    }
  });

  test('créditer une boutique inconnue échoue', async () => {
    const prisma = makeFakePrisma({ shop: [] });
    const service = new EarningsService(prisma as never, { requireOwnedShop: async () => ({}) } as never);
    await assert.rejects(() => service.credit('inconnue', 5_000), /introuvable/i);
  });

  test('seul un retrait en attente peut être marqué versé', async () => {
    const prisma = makeFakePrisma({
      creatorEarning: [{ id: 'e1', shopId: 'b1', amount: 12_000, status: 'AVAILABLE', kind: 'affiliate' }],
    });
    const service = new EarningsService(prisma as never, {} as never);
    await assert.rejects(
      () => service.markWithdrawalPaid('e1'),
      /pas un retrait/i,
      'marquer versé un gain le sortirait du disponible sans que rien ne soit parti',
    );
  });

  test('marquer versé horodate et garde la référence du virement', async () => {
    const prisma = makeFakePrisma({
      creatorEarning: [{ id: 'r1', shopId: 'b1', amount: -30_000, status: 'REQUESTED', kind: 'withdrawal' }],
    });
    const service = new EarningsService(prisma as never, {} as never);
    await service.markWithdrawalPaid('r1', 'WAVE-778');

    const maj = callsOf(prisma).find((c) => c.model === 'creatorEarning' && c.method === 'update');
    const data = (maj!.args as { data: Record<string, unknown> }).data;
    assert.equal(data.status, 'PAID');
    assert.equal(data.transferRef, 'WAVE-778');
    assert.ok(data.paidAt, 'la date de versement est posée par le serveur');
  });
});

describe('EarningsService — le seuil', () => {
  test('il vaut bien 25 000 FCFA', () => {
    assert.equal(SEUIL, 25_000);
  });
});
