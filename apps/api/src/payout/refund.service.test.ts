import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RefundService } from './refund.service.ts';
import { makeFakePrisma, makeFakeMail, callsOf } from '../testing/fake-prisma.ts';

/**
 * Commande payée et livrée du client A, boutique 1 : 3 chemises à 5 000 et
 * 1 pantalon à 12 000, plus 1 500 de livraison.
 */
function commandeLivree(over: Record<string, unknown> = {}) {
  return {
    id: 'cmd-1',
    orderNumber: 'ODL-1',
    customerId: 'client-A',
    shopId: 'boutique-1',
    status: 'DELIVERED',
    currency: 'XOF',
    totalAmount: '28500.00',
    shippingAmount: '1500.00',
    commissionRate: '0.1000',
    sellerAmount: '25800.00',
    platformAmount: '2700.00',
    payoutId: null,
    deliveredAt: new Date('2026-08-01'),
    payment: { paid: true },
    items: [
      { id: 'l1', productName: 'Chemise', quantity: 3, unitPrice: '5000.00' },
      { id: 'l2', productName: 'Pantalon', quantity: 1, unitPrice: '12000.00' },
    ],
    refunds: [],
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

/** Données envoyées au `create` du remboursement. */
function created(prisma: unknown): Record<string, unknown> {
  const call = callsOf(prisma).find((c) => c.model === 'refund' && c.method === 'create');
  assert.ok(call, 'un remboursement doit être créé');
  return (call!.args as { data: Record<string, unknown> }).data;
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

  test('une commande annulée n’est plus remboursable', async () => {
    const { service } = build({ order: [commandeLivree({ status: 'CANCELLED' })] });
    await assert.rejects(() => service.request('client-A', 'cmd-1', 'trop tard'), /ne peut plus/i);
  });

  test('sans détail, la demande porte sur toute la commande', async () => {
    const { service, prisma } = build({ order: [commandeLivree()] });
    await service.request('client-A', 'cmd-1', '  colis jamais reçu  ');

    const data = created(prisma);
    assert.equal(data.amount, '28500.00', 'articles et livraison');
    assert.equal(data.shippingShare, '1500.00');
    assert.equal(data.full, true);
    assert.equal(data.reason, 'colis jamais reçu', 'le motif est nettoyé de ses espaces');
    assert.equal(data.platformShare, '2700.00', 'la commission est reprise sur les articles');
    assert.equal(data.sellerShare, '25800.00');
  });
});

describe('RefundService — remboursement partiel', () => {
  test('une seule unité rendue ne rembourse que celle-là', async () => {
    const { service, prisma } = build({ order: [commandeLivree()] });
    await service.request('client-A', 'cmd-1', 'une chemise tachée', [
      { orderItemId: 'l1', quantity: 1 },
    ]);

    const data = created(prisma);
    assert.equal(data.amount, '5000.00');
    assert.equal(data.shippingShare, '0.00', 'le client a bien été livré pour le reste');
    assert.equal(data.full, false);
  });

  test('une demande en attente réserve ses unités', async () => {
    const { service } = build({
      order: [
        commandeLivree({
          refunds: [{ status: 'REQUESTED', items: [{ orderItemId: 'l1', quantity: 3 }] }],
        }),
      ],
    });
    await assert.rejects(
      () => service.request('client-A', 'cmd-1', 'encore', [{ orderItemId: 'l1', quantity: 1 }]),
      /déjà été entièrement remboursé/i,
      'sans cette réserve, deux demandes coup sur coup rendraient l’article en double',
    );
  });

  test('un refus rend ses unités : le client peut redemander', async () => {
    const { service, prisma } = build({
      order: [
        commandeLivree({
          refunds: [{ status: 'REJECTED', items: [{ orderItemId: 'l1', quantity: 3 }] }],
        }),
      ],
    });
    await service.request('client-A', 'cmd-1', 'je conteste', [
      { orderItemId: 'l1', quantity: 3 },
    ]);
    assert.equal(created(prisma).amount, '15000.00');
  });

  test('une commande entièrement rendue n’accepte plus de demande', async () => {
    const { service } = build({
      order: [
        commandeLivree({
          refunds: [
            {
              status: 'APPROVED',
              items: [
                { orderItemId: 'l1', quantity: 3 },
                { orderItemId: 'l2', quantity: 1 },
              ],
            },
          ],
        }),
      ],
    });
    await assert.rejects(
      () => service.request('client-A', 'cmd-1', 'encore'),
      /déjà été entièrement remboursée/i,
    );
  });

  test('un remboursement d’avant le partiel bloque toute nouvelle demande', async () => {
    const { service } = build({
      // Les remboursements créés avant cette fonctionnalité n'ont pas de
      // lignes : les compter pour zéro rouvrirait une commande déjà soldée.
      order: [commandeLivree({ refunds: [{ status: 'APPROVED', items: [] }] })],
    });
    await assert.rejects(
      () => service.request('client-A', 'cmd-1', 'encore'),
      /déjà été entièrement remboursée/i,
    );
  });

  test('le second remboursement solde la commande et emporte la livraison', async () => {
    const { service, prisma } = build({
      order: [
        commandeLivree({
          refunds: [{ status: 'APPROVED', items: [{ orderItemId: 'l1', quantity: 3 }] }],
        }),
      ],
    });
    await service.request('client-A', 'cmd-1', 'le pantalon aussi');

    const data = created(prisma);
    assert.equal(data.amount, '13500.00', '12 000 de pantalon et 1 500 de livraison');
    assert.equal(data.shippingShare, '1500.00');
    assert.equal(data.full, true);
  });

  test('la liste du remboursable retire ce qui est déjà engagé', async () => {
    const { service } = build({
      order: [
        commandeLivree({
          refunds: [{ status: 'REQUESTED', items: [{ orderItemId: 'l1', quantity: 2 }] }],
        }),
      ],
    });
    const dispo = await service.refundable('client-A', 'cmd-1');
    assert.equal(dispo.items.find((i) => i.id === 'l1')!.refundable, 1);
    assert.equal(dispo.items.find((i) => i.id === 'l2')!.refundable, 1);
  });
});

describe('RefundService — décision du vendeur', () => {
  function demande(over: Record<string, unknown> = {}) {
    return {
      id: 'rb-1',
      status: 'REQUESTED',
      sellerShare: '4500.00',
      items: [{ orderItemId: 'l1', quantity: 1 }],
      order: {
        id: 'cmd-1',
        shopId: 'boutique-1',
        payoutId: null,
        orderNumber: 'ODL-1',
        customer: { email: 'client@test.ci' },
        items: [
          { id: 'l1', quantity: 3 },
          { id: 'l2', quantity: 1 },
        ],
        refunds: [{ id: 'rb-1', status: 'REQUESTED', items: [{ orderItemId: 'l1', quantity: 1 }] }],
      },
      ...over,
    };
  }

  /** Demande couvrant la totalité de la commande. */
  function demandeTotale() {
    const lignes = [
      { orderItemId: 'l1', quantity: 3 },
      { orderItemId: 'l2', quantity: 1 },
    ];
    const d = demande({ items: lignes });
    d.order.refunds = [{ id: 'rb-1', status: 'REQUESTED', items: lignes }];
    return d;
  }

  test('un vendeur ne peut pas trancher la demande d’une autre boutique', async () => {
    const { service } = build({ refund: [demande()] });
    await assert.rejects(
      () => service.decide('boutique-2', 'rb-1', true),
      /n’est pas la vôtre/i,
      'c’est la garde la plus importante du service',
    );
  });

  test('une demande déjà tranchée ne peut pas l’être une seconde fois', async () => {
    const { service } = build({ refund: [demande({ status: 'APPROVED' })] });
    await assert.rejects(
      () => service.decide('boutique-1', 'rb-1', false, 'non'),
      /déjà été tranchée/i,
    );
  });

  test('accorder un partiel laisse la commande dans son statut', async () => {
    const { service, prisma } = build({ refund: [demande()], order: [commandeLivree()] });
    await service.decide('boutique-1', 'rb-1', true, 'désolé pour la gêne');

    const maj = callsOf(prisma).find((c) => c.model === 'order' && c.method === 'update');
    assert.equal(
      maj,
      undefined,
      'la commande reste livrée : le client garde ce qu’il n’a pas rendu',
    );
  });

  test('accorder le dernier remboursement bascule la commande en remboursée', async () => {
    const { service, prisma } = build({ refund: [demandeTotale()], order: [commandeLivree()] });
    await service.decide('boutique-1', 'rb-1', true);

    const maj = callsOf(prisma).find((c) => c.model === 'order' && c.method === 'update');
    assert.ok(maj, 'la commande doit être mise à jour');
    assert.equal((maj!.args as { data: { status: string } }).data.status, 'REFUNDED');
  });

  test('refuser ne touche pas au statut de la commande', async () => {
    const { service, prisma } = build({ refund: [demandeTotale()], order: [commandeLivree()] });
    await service.decide('boutique-1', 'rb-1', false, 'article utilisé');

    const maj = callsOf(prisma).find((c) => c.model === 'order' && c.method === 'update');
    assert.equal(maj, undefined, 'un refus laisse la commande telle quelle');
  });

  test('une demande concurrente refusée n’empêche pas de solder la commande', async () => {
    // rb-2 couvre le reste ; rb-1, déposée avant, a été refusée. Compter les
    // demandes en attente ici laisserait la commande éternellement ouverte.
    const d = demande({
      id: 'rb-2',
      items: [
        { orderItemId: 'l1', quantity: 3 },
        { orderItemId: 'l2', quantity: 1 },
      ],
    });
    d.order.refunds = [
      { id: 'rb-1', status: 'REJECTED', items: [{ orderItemId: 'l1', quantity: 1 }] },
      {
        id: 'rb-2',
        status: 'REQUESTED',
        items: [
          { orderItemId: 'l1', quantity: 3 },
          { orderItemId: 'l2', quantity: 1 },
        ],
      },
    ];
    const { service, prisma } = build({ refund: [d], order: [commandeLivree()] });
    await service.decide('boutique-1', 'rb-2', true);

    const maj = callsOf(prisma).find((c) => c.model === 'order' && c.method === 'update');
    assert.ok(maj, 'la commande est bien intégralement rendue');
    assert.equal((maj!.args as { data: { status: string } }).data.status, 'REFUNDED');
  });

  test('le client est informé dans les deux cas', async () => {
    for (const approve of [true, false]) {
      const { service, mail } = build({ refund: [demande()], order: [commandeLivree()] });
      await service.decide('boutique-1', 'rb-1', approve, 'motif');
      // L'envoi est lancé sans être attendu : on laisse la file s'écouler.
      await new Promise((r) => setTimeout(r, 0));
      const envoi = mail.sent.find((m) => m.kind === 'refundDecision');
      assert.ok(envoi, `une décision « ${approve} » doit être notifiée`);
      assert.equal(envoi!.to, 'client@test.ci');
    }
  });
});
