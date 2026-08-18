import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RefundService } from './refund.service.ts';
import { makeFakePrisma, makeFakeMail, callsOf } from '../testing/fake-prisma.ts';

/** Commande payée et livrée, appartenant au client A et à la boutique 1. */
function commandeLivree(over: Record<string, unknown> = {}) {
  return {
    id: 'cmd-1',
    orderNumber: 'ODL-1',
    customerId: 'client-A',
    shopId: 'boutique-1',
    status: 'DELIVERED',
    totalAmount: '10000.00',
    sellerAmount: '9000.00',
    platformAmount: '1000.00',
    payoutId: null,
    payment: { paid: true },
    refund: null,
    customer: { email: 'client@test.ci' },
    shop: { owner: { email: 'vendeur@test.ci' } },
    ...over,
  };
}

function build(db: Record<string, Record<string, unknown>[]>) {
  const prisma = makeFakePrisma(db);
  const mail = makeFakeMail();
  const service = new RefundService(prisma as never, mail as never);
  return { service, prisma, mail };
}

describe('RefundService — demande du client', () => {
  test('un client ne peut pas demander le remboursement de la commande d’un autre', async () => {
    const { service } = build({ order: [commandeLivree()] });
    await assert.rejects(
      () => service.request('client-B', 'cmd-1', 'article abîmé'),
      /introuvable/i,
      'la commande d’autrui doit être traitée comme inexistante, pas comme interdite',
    );
  });

  test('une commande impayée ne peut pas être remboursée', async () => {
    const { service } = build({
      order: [commandeLivree({ status: 'PENDING', payment: { paid: false } })],
    });
    await assert.rejects(() => service.request('client-A', 'cmd-1', 'erreur'), /payée/i);
  });

  test('une commande ne peut pas faire l’objet de deux demandes', async () => {
    const { service } = build({
      order: [commandeLivree({ refund: { id: 'rb-1', status: 'REQUESTED' } })],
    });
    await assert.rejects(() => service.request('client-A', 'cmd-1', 'encore'), /déjà en cours/i);
  });

  test('une commande annulée n’est plus remboursable', async () => {
    const { service } = build({ order: [commandeLivree({ status: 'CANCELLED' })] });
    await assert.rejects(() => service.request('client-A', 'cmd-1', 'trop tard'), /ne peut plus/i);
  });

  test('la demande recopie les parts figées sur la commande', async () => {
    const { service, prisma } = build({ order: [commandeLivree()] });
    await service.request('client-A', 'cmd-1', '  article abîmé  ');

    const create = callsOf(prisma).find((c) => c.model === 'refund' && c.method === 'create');
    assert.ok(create, 'un remboursement doit être créé');
    const data = (create!.args as { data: Record<string, unknown> }).data;
    assert.equal(data.sellerShare, '9000.00', 'la part vendeur vient de la commande, pas d’un recalcul');
    assert.equal(data.platformShare, '1000.00');
    assert.equal(data.status, undefined, 'le statut par défaut REQUESTED est laissé au schéma');
    assert.equal(data.reason, 'article abîmé', 'le motif est nettoyé de ses espaces');
  });
});

describe('RefundService — décision du vendeur', () => {
  const demande = {
    id: 'rb-1',
    status: 'REQUESTED',
    sellerShare: '9000.00',
    order: {
      id: 'cmd-1',
      shopId: 'boutique-1',
      payoutId: null,
      orderNumber: 'ODL-1',
      customer: { email: 'client@test.ci' },
    },
  };

  test('un vendeur ne peut pas trancher la demande d’une autre boutique', async () => {
    const { service } = build({ refund: [{ ...demande }] });
    await assert.rejects(
      () => service.decide('boutique-2', 'rb-1', true),
      /n’est pas la vôtre/i,
      'c’est la garde la plus importante du service',
    );
  });

  test('une demande déjà tranchée ne peut pas l’être une seconde fois', async () => {
    const { service } = build({ refund: [{ ...demande, status: 'APPROVED' }] });
    await assert.rejects(() => service.decide('boutique-1', 'rb-1', false, 'non'), /déjà été tranchée/i);
  });

  test('accorder bascule la commande en remboursée', async () => {
    const { service, prisma } = build({
      refund: [{ ...demande }],
      order: [commandeLivree()],
    });
    await service.decide('boutique-1', 'rb-1', true, 'désolé pour la gêne');

    const maj = callsOf(prisma).find((c) => c.model === 'order' && c.method === 'update');
    assert.ok(maj, 'la commande doit être mise à jour');
    assert.equal((maj!.args as { data: { status: string } }).data.status, 'REFUNDED');
  });

  test('refuser ne touche pas au statut de la commande', async () => {
    const { service, prisma } = build({
      refund: [{ ...demande }],
      order: [commandeLivree()],
    });
    await service.decide('boutique-1', 'rb-1', false, 'article utilisé');

    const maj = callsOf(prisma).find((c) => c.model === 'order' && c.method === 'update');
    assert.equal(maj, undefined, 'un refus laisse la commande telle quelle');
  });

  test('le client est informé dans les deux cas', async () => {
    for (const approve of [true, false]) {
      const { service, mail } = build({ refund: [{ ...demande }], order: [commandeLivree()] });
      await service.decide('boutique-1', 'rb-1', approve, 'motif');
      // L'envoi est lancé sans être attendu : on laisse la file s'écouler.
      await new Promise((r) => setTimeout(r, 0));
      const envoi = mail.sent.find((m) => m.kind === 'refundDecision');
      assert.ok(envoi, `une décision « ${approve} » doit être notifiée`);
      assert.equal(envoi!.to, 'client@test.ci');
    }
  });
});
