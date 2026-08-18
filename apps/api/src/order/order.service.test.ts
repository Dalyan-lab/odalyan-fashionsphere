import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { OrderService } from './order.service.ts';
import { makeFakePrisma, makeFakeMail, callsOf } from '../testing/fake-prisma.ts';

function commande(over: Record<string, unknown> = {}) {
  return {
    id: 'cmd-1',
    orderNumber: 'ODL-1',
    shopId: 'b1',
    status: 'PAID',
    shippedAt: null,
    deliveredAt: null,
    carrier: null,
    trackingNumber: null,
    customer: { email: 'client@test.ci' },
    shop: { name: 'Boutique' },
    ...over,
  };
}

function build(db: Record<string, Record<string, unknown>[]>) {
  const prisma = makeFakePrisma(db);
  const mail = makeFakeMail();
  // Paiement et livraison ne sont pas sollicités par `updateStatus`.
  const service = new OrderService(prisma as never, {} as never, mail as never, {} as never);
  return { service, prisma, mail };
}

/** Données envoyées au `update` de la commande. */
function updateData(prisma: unknown): Record<string, unknown> {
  const call = callsOf(prisma).find((c) => c.model === 'order' && c.method === 'update');
  assert.ok(call, 'la commande devait être mise à jour');
  return (call!.args as { data: Record<string, unknown> }).data;
}

describe('OrderService — changement de statut', () => {
  test('un vendeur ne peut pas modifier la commande d’une autre boutique', async () => {
    const { service } = build({ order: [commande()] });
    await assert.rejects(
      () => service.updateStatus('b2', 'cmd-1', { status: 'SHIPPED' }),
      /introuvable/i,
    );
  });

  test('le passage à expédiée horodate l’expédition', async () => {
    const { service, prisma } = build({ order: [commande()] });
    await service.updateStatus('b1', 'cmd-1', { status: 'SHIPPED' });
    assert.ok(updateData(prisma).shippedAt, 'la date est posée par le serveur, pas déclarée');
  });

  test('un retour en arrière ne réécrit pas la date d’expédition d’origine', async () => {
    const { service, prisma } = build({
      order: [commande({ status: 'DELIVERED', shippedAt: new Date('2026-01-01') })],
    });
    await service.updateStatus('b1', 'cmd-1', { status: 'SHIPPED' });
    assert.equal(
      updateData(prisma).shippedAt,
      undefined,
      'la date d’origine doit rester vérifiable en cas de litige',
    );
  });

  test('corriger un numéro de suivi n’efface pas le transporteur', async () => {
    const { service, prisma } = build({
      order: [commande({ status: 'SHIPPED', carrier: 'DHL', trackingNumber: 'AAA' })],
    });
    await service.updateStatus('b1', 'cmd-1', { status: 'SHIPPED', trackingNumber: 'BBB' });
    const data = updateData(prisma);
    assert.equal(data.trackingNumber, 'BBB');
    assert.equal(data.carrier, undefined, 'un champ non envoyé ne doit pas être touché');
  });

  test('le client est prévenu au changement de statut', async () => {
    const { service, mail } = build({ order: [commande()] });
    await service.updateStatus('b1', 'cmd-1', { status: 'SHIPPED' });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(mail.sent.filter((m) => m.kind === 'orderStatus').length, 1);
  });

  test('réenregistrer le même statut sans nouveauté n’envoie pas d’email', async () => {
    const { service, mail } = build({
      order: [commande({ status: 'SHIPPED', carrier: 'DHL' })],
    });
    await service.updateStatus('b1', 'cmd-1', { status: 'SHIPPED', carrier: 'DHL' });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(mail.sent.length, 0, 'corriger une saisie ne doit pas relancer le client');
  });
});
