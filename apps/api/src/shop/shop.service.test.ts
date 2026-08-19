import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ShopService } from './shop.service.ts';
import { makeFakePrisma } from '../testing/fake-prisma.ts';

/**
 * Le fil d'activité assemble huit sources. C'est la fusion et le tri qui
 * peuvent être faux — pas les requêtes, que la base valide d'elle-même.
 */

const IL_Y_A = (heures: number) => new Date(Date.now() - heures * 3600_000);

function build(db: Record<string, Record<string, unknown>[]>) {
  const prisma = makeFakePrisma({ shop: [{ id: 'b1', ownerId: 'u1' }], ...db });
  return new ShopService(prisma as never);
}

describe('ShopService — fil d’activité', () => {
  test('sans boutique, l’accès est refusé', async () => {
    const prisma = makeFakePrisma({ shop: [] });
    const service = new ShopService(prisma as never);
    await assert.rejects(() => service.recentActivity('u1'), /boutique/i);
  });

  test('les événements sont rendus du plus récent au plus ancien', async () => {
    const service = build({
      order: [
        { shopId: 'b1', orderNumber: 'ODL-1', totalAmount: '10000', currency: 'XOF', createdAt: IL_Y_A(50), shippedAt: IL_Y_A(2), deliveredAt: null },
      ],
      payout: [{ shopId: 'b1', reference: 'PO-1', amount: '9000', currency: 'XOF', paidAt: IL_Y_A(20) }],
      review: [{ shopId: 'b1', rating: 5, author: 'Awa', createdAt: IL_Y_A(1), product: { name: 'Boubou' } }],
    });

    const fil = await service.recentActivity('u1');
    const dates = fil.map((e) => e.at.getTime());
    assert.deepEqual(
      [...dates].sort((a, b) => b - a),
      dates,
      'un fil dans le désordre serait illisible',
    );
    assert.equal(fil[0]!.type, 'REVIEW_ADDED', 'le plus frais arrive en tête');
  });

  test('une même commande produit un événement par étape franchie', async () => {
    const service = build({
      order: [
        {
          shopId: 'b1',
          orderNumber: 'ODL-7',
          totalAmount: '25000',
          currency: 'XOF',
          createdAt: IL_Y_A(72),
          shippedAt: IL_Y_A(48),
          deliveredAt: IL_Y_A(12),
        },
      ],
    });

    const types = (await service.recentActivity('u1')).map((e) => e.type);
    assert.deepEqual(types, ['ORDER_DELIVERED', 'ORDER_SHIPPED', 'ORDER_PAID']);
  });

  test('le montant et la référence accompagnent la commande payée', async () => {
    const service = build({
      order: [{ shopId: 'b1', orderNumber: 'ODL-9', totalAmount: '31500.00', currency: 'XOF', createdAt: IL_Y_A(3), shippedAt: null, deliveredAt: null }],
    });
    const paye = (await service.recentActivity('u1')).find((e) => e.type === 'ORDER_PAID');
    assert.equal(paye!.ref, 'ODL-9');
    assert.equal(paye!.amount, 31500, 'un montant décimal devient un nombre, pas une chaîne');
  });

  test('un remboursement tranché dit s’il a été accordé', async () => {
    const service = build({
      refund: [
        {
          shopId: 'b1',
          status: 'APPROVED',
          amount: '5000',
          createdAt: IL_Y_A(30),
          decidedAt: IL_Y_A(4),
          order: { shopId: 'b1', orderNumber: 'ODL-3', currency: 'XOF' },
        },
      ],
    });
    const fil = await service.recentActivity('u1');
    const decide = fil.find((e) => e.type === 'REFUND_DECIDED');
    assert.equal(decide!.approved, true, 'refusé et accordé ne se racontent pas pareil');
    assert.ok(
      fil.some((e) => e.type === 'REFUND_REQUESTED'),
      'la demande reste au fil même une fois tranchée : c’est l’historique',
    );
  });

  test('aucune phrase n’est composée côté serveur', async () => {
    const service = build({
      scheduledPost: [{ shopId: 'b1', networks: ['TikTok', 'Instagram'], publishedAt: IL_Y_A(5), status: 'PUBLISHED' }],
    });
    const post = (await service.recentActivity('u1'))[0]!;
    assert.deepEqual(post.networks, ['TikTok', 'Instagram']);
    // La rédaction appartient au client, qui connaît la langue de l'utilisateur.
    // Le type est un jeton machine, en majuscules et sans espace ; aucun champ
    // ne transporte de phrase toute faite.
    assert.match(post.type, /^[A-Z_]+$/);
    assert.equal(
      Object.entries(post).some(([cle, v]) => cle !== 'type' && typeof v === 'string' && v.includes(' ')),
      false,
      'une phrase envoyée par le serveur serait figée en français',
    );
  });

  test('le fil est plafonné', async () => {
    const service = build({
      order: Array.from({ length: 30 }, (_, i) => ({
        shopId: 'b1',
        orderNumber: `ODL-${i}`,
        totalAmount: '1000',
        currency: 'XOF',
        createdAt: IL_Y_A(i + 1),
        shippedAt: null,
        deliveredAt: null,
      })),
    });
    assert.equal((await service.recentActivity('u1', 12)).length, 12);
  });

  test('une boutique sans rien renvoie un fil vide, pas une erreur', async () => {
    assert.deepEqual(await build({}).recentActivity('u1'), []);
  });
});
