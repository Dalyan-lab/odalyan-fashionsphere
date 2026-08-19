import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PayoutService } from './payout.service.ts';
import { makeFakePrisma, callsOf } from '../testing/fake-prisma.ts';

function build(db: Record<string, Record<string, unknown>[]>, debts: unknown[] = []) {
  const prisma = makeFakePrisma(db);
  const refunds = { outstandingDebts: () => Promise.resolve(debts) };
  return { service: new PayoutService(prisma as never, refunds as never), prisma };
}

describe('PayoutService — garde-fous du versement', () => {
  test('refuse de préparer un versement pour une boutique inconnue', async () => {
    const { service } = build({ shop: [] });
    await assert.rejects(() => service.create('inconnue'), /introuvable/i);
  });

  test('refuse tant que le vendeur n’a pas donné ses coordonnées', async () => {
    const { service } = build({ shop: [{ id: 'b1', name: 'Boutique', payoutNumber: null }] });
    await assert.rejects(
      () => service.create('b1'),
      /coordonnées/i,
      'préparer un versement qu’on ne peut pas exécuter n’a aucun sens',
    );
  });

  test('refuse quand aucune commande n’est versable', async () => {
    const { service } = build({
      shop: [{ id: 'b1', payoutNumber: '0700000000' }],
      order: [],
    });
    await assert.rejects(() => service.create('b1'), /aucune commande/i);
  });
});

describe('PayoutService — remboursements et versement', () => {
  const boutique = { id: 'b1', payoutNumber: '0700000000', payoutMethod: 'MOBILE_MONEY' };
  const vendue = {
    id: 'c1',
    shopId: 'b1',
    status: 'DELIVERED',
    sellerAmount: '25800.00',
    currency: 'XOF',
    payoutId: null,
    deliveredAt: new Date('2026-01-01'),
    payment: { paid: true },
  };

  /** Montant envoyé à la création du versement. */
  function montant(prisma: unknown): string {
    const call = callsOf(prisma).find((c) => c.model === 'payout' && c.method === 'create');
    assert.ok(call, 'un versement doit être créé');
    return String((call!.args as { data: { amount: unknown } }).data.amount);
  }

  test('un remboursement partiel est retenu sur le versement', async () => {
    const { service, prisma } = build({ shop: [boutique], order: [{ ...vendue }] }, [
      { id: 'rb-1', sellerShare: '4500.00' },
    ]);
    await service.create('b1');
    assert.equal(montant(prisma), '21300', '25 800 de vente moins 4 500 rendus');
  });

  test('une commande remboursée en totalité laisse un versement nul', async () => {
    // Elle reste comptée comme vente : c'est la dette qui l'annule. L'exclure
    // *et* réclamer la dette reprendrait deux fois la même somme au vendeur.
    const { service, prisma } = build(
      { shop: [boutique], order: [{ ...vendue, status: 'REFUNDED' }] },
      [{ id: 'rb-1', sellerShare: '25800.00' }],
    );
    await service.create('b1');
    assert.equal(montant(prisma), '0');
  });

  test('une dette plus lourde que le solde est reportée, jamais prélevée à moitié', async () => {
    const { service, prisma } = build({ shop: [boutique], order: [{ ...vendue }] }, [
      { id: 'rb-1', sellerShare: '40000.00' },
    ]);
    await service.create('b1');
    assert.equal(montant(prisma), '25800', 'le versement ne devient pas négatif');

    const solde = callsOf(prisma).find((c) => c.model === 'refund' && c.method === 'updateMany');
    assert.equal(solde, undefined, 'la dette n’est pas marquée réglée puisqu’elle ne l’est pas');
  });
});

describe('PayoutService — versement effectué', () => {
  const versement = { id: 'vs-1', shopId: 'b1', status: 'PENDING', amount: '10000.00' };

  test('marquer versé enregistre la référence du virement', async () => {
    const { service, prisma } = build({ payout: [{ ...versement }] });
    await service.markPaid('vs-1', 'WAVE-123', 'note');

    const maj = callsOf(prisma).find((c) => c.model === 'payout' && c.method === 'update');
    assert.ok(maj, 'le versement doit être mis à jour');
    const data = (maj!.args as { data: Record<string, unknown> }).data;
    assert.equal(data.status, 'PAID');
    assert.equal(data.transferRef, 'WAVE-123');
    assert.ok(data.paidAt, 'la date de versement est posée par le serveur');
  });

  test('marquer versé deux fois laisse le premier versement intact', async () => {
    const { service, prisma } = build({
      payout: [{ ...versement, status: 'PAID', paidAt: new Date('2026-01-01') }],
    });
    await service.markPaid('vs-1', 'AUTRE-REF');
    assert.equal(
      callsOf(prisma).some((c) => c.model === 'payout' && c.method === 'update'),
      false,
      'un versement déjà payé ne doit pas être réécrit',
    );
  });

  test('un versement déjà payé ne peut pas être annulé', async () => {
    const { service } = build({ payout: [{ ...versement, status: 'PAID' }] });
    await assert.rejects(() => service.cancel('vs-1'), /déjà payé/i);
  });

  test('annuler rend ses commandes au solde disponible', async () => {
    const { service, prisma } = build({
      payout: [{ ...versement }],
      order: [{ id: 'c1', payoutId: 'vs-1' }],
    });
    await service.cancel('vs-1');

    const relache = callsOf(prisma).find((c) => c.model === 'order' && c.method === 'updateMany');
    assert.ok(relache, 'les commandes doivent être détachées du versement');
    assert.equal((relache!.args as { data: { payoutId: null } }).data.payoutId, null);
  });
});
