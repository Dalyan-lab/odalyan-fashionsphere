/**
 * Jeu de démonstration : des commandes réelles pour éprouver le parcours complet.
 *
 * L'amorçage ordinaire (`seed.ts`) ne crée que des comptes, une boutique et des
 * produits. Rien ne permettait donc de voir fonctionner le suivi de livraison,
 * les remboursements ni les versements : ces écrans restaient vides faute de
 * commande, et il fallait un vrai paiement pour les remplir.
 *
 * Ce script pose ces commandes directement, dans tous les états utiles.
 *
 *   pnpm --filter @odalyan/api db:demo          crée le jeu
 *   pnpm --filter @odalyan/api db:demo:clean    le retire
 *
 * **Il est séparé de l'amorçage normal à dessein.** La base de production est
 * la même : ces commandes compteraient dans le chiffre d'affaires affiché. Elles
 * portent toutes le préfixe `DEMO-`, ce qui les rend reconnaissables et
 * permet de les supprimer sans risque pour les vraies.
 */
import { PrismaClient, PayoutMethod, PaymentProvider } from '@prisma/client';

const prisma = new PrismaClient();

/** Préfixe de reconnaissance : c'est lui qui rend le nettoyage sûr. */
const PREFIXE = 'DEMO-';

const jours = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

/** Commission par défaut de la plateforme, pour figer les parts comme à l'encaissement. */
const TAUX = 0.1;

async function nettoyer() {
  const commandes = await prisma.order.findMany({
    where: { orderNumber: { startsWith: PREFIXE } },
    select: { id: true, payoutId: true },
  });
  const ids = commandes.map((c) => c.id);
  if (ids.length === 0) {
    console.log('Rien à retirer.');
    return;
  }

  // Les remboursements et leurs lignes tombent en cascade avec la commande ;
  // les versements, eux, survivent (`onDelete: SetNull`) et doivent être visés
  // à part. On ne retire que ceux dont **toutes** les commandes sont de
  // démonstration : un versement qui en mêlerait de vraies serait un document
  // comptable réel, et le supprimer effacerait une trace de paiement.
  const candidats = [...new Set(commandes.map((c) => c.payoutId).filter(Boolean))] as string[];
  const purementDemo: string[] = [];
  for (const payoutId of candidats) {
    const etrangeres = await prisma.order.count({
      where: { payoutId, orderNumber: { not: { startsWith: PREFIXE } } },
    });
    if (etrangeres === 0) purementDemo.push(payoutId);
    else console.log(`⚠️  Versement ${payoutId} conservé : il contient de vraies commandes.`);
  }

  await prisma.order.deleteMany({ where: { id: { in: ids } } });
  if (purementDemo.length) {
    await prisma.payout.deleteMany({ where: { id: { in: purementDemo } } });
  }
  await prisma.orderGroup.deleteMany({ where: { reference: { startsWith: PREFIXE } } });
  console.log(`🧹 ${ids.length} commande(s) de démonstration retirée(s).`);
}

async function main() {
  if (process.argv.includes('--clean')) {
    await nettoyer();
    return;
  }

  const seller = await prisma.user.findUnique({ where: { email: 'vendeur@odalyan.ai' } });
  const client = await prisma.user.findUnique({ where: { email: 'client@odalyan.ai' } });
  if (!seller || !client) {
    throw new Error('Lancez d’abord `pnpm db:seed` : les comptes de démonstration manquent.');
  }

  const shop = await prisma.shop.findUnique({ where: { ownerId: seller.id } });
  if (!shop) throw new Error('La boutique de démonstration est absente.');

  // Coordonnées de reversement et frais de port : sans elles, l'écran des
  // versements refuse de préparer quoi que ce soit et le test s'arrête là.
  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      payoutMethod: PayoutMethod.MOBILE_MONEY,
      payoutOperator: 'Wave',
      payoutNumber: '+225 07 00 00 00 00',
      payoutHolderName: 'Awa Diop',
      shippingFee: 1500,
      // Seuil placé au-dessus de la plus grosse commande du jeu : sans quoi
      // toutes seraient livrées gratuitement et les 1 500 facturés plus bas
      // contrediraient le réglage affiché au vendeur.
      freeShippingFrom: 500000,
      deliveryDaysMin: 2,
      deliveryDaysMax: 5,
    },
  });

  const produits = await prisma.product.findMany({
    where: { shopId: shop.id },
    take: 3,
    orderBy: { createdAt: 'asc' },
  });
  if (produits.length === 0) throw new Error('Aucun produit : lancez `pnpm db:seed`.');

  /** Crée une commande complète : lignes, paiement encaissé et parts figées. */
  async function commande(opts: {
    suffixe: string;
    // Littéral plutôt que l'énumération générée, comme dans les services :
    // le client Prisma ne l'expose pas de façon fiable hors CommonJS.
    status: 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED';
    lignes: { produit: (typeof produits)[number]; quantite: number }[];
    livraison: number;
    creeIlYa: number;
    expedieIlYa?: number;
    livreIlYa?: number;
    suivi?: { carrier: string; trackingNumber: string };
  }) {
    const orderNumber = `${PREFIXE}${opts.suffixe}`;
    const existante = await prisma.order.findUnique({ where: { orderNumber } });
    if (existante) return existante;

    const articles = opts.lignes.reduce(
      (s, l) => s + Number(l.produit.price) * l.quantite,
      0,
    );
    const total = articles + opts.livraison;
    // Mêmes règles qu'à l'encaissement : la commission ne porte pas sur le
    // transport, et le vendeur reçoit le reste.
    const platformAmount = Math.round(articles * TAUX);
    const sellerAmount = total - platformAmount;

    return prisma.order.create({
      data: {
        orderNumber,
        status: opts.status,
        totalAmount: total,
        shippingAmount: opts.livraison,
        currency: 'XOF',
        customerId: client!.id,
        shopId: shop!.id,
        createdAt: jours(opts.creeIlYa),
        shippedAt: opts.expedieIlYa != null ? jours(opts.expedieIlYa) : null,
        deliveredAt: opts.livreIlYa != null ? jours(opts.livreIlYa) : null,
        carrier: opts.suivi?.carrier ?? null,
        trackingNumber: opts.suivi?.trackingNumber ?? null,
        commissionRate: TAUX,
        platformAmount,
        sellerAmount,
        shippingAddress: {
          fullName: 'Liam Martin',
          line1: 'Cocody, Rue des Jardins',
          city: 'Abidjan',
          country: 'Côte d’Ivoire',
          phone: '+225 07 11 22 33 44',
        },
        items: {
          create: opts.lignes.map((l) => ({
            productId: l.produit.id,
            productName: l.produit.name,
            quantity: l.quantite,
            unitPrice: l.produit.price,
          })),
        },
        payment: {
          create: {
            provider: PaymentProvider.PAYSTACK,
            providerRef: `demo_${opts.suffixe.toLowerCase()}`,
            amount: total,
            currency: 'XOF',
            paid: true,
          },
        },
      },
    });
  }

  const [p1, p2, p3] = produits;

  // Une commande par étape du parcours, pour que chaque écran ait de quoi montrer.
  await commande({
    suffixe: '001',
    status: 'PAID',
    lignes: [{ produit: p1!, quantite: 1 }],
    livraison: 1500,
    creeIlYa: 1,
  });

  await commande({
    suffixe: '002',
    status: 'PROCESSING',
    lignes: [{ produit: p2!, quantite: 2 }],
    livraison: 1500,
    creeIlYa: 3,
  });

  await commande({
    suffixe: '003',
    status: 'SHIPPED',
    lignes: [{ produit: p3 ?? p1!, quantite: 1 }],
    livraison: 1500,
    creeIlYa: 6,
    expedieIlYa: 2,
    suivi: { carrier: 'DHL Côte d’Ivoire', trackingNumber: 'CI4471902388' },
  });

  // Livrée hier : encore sous garantie, donc visible en « en attente » et non
  // versable — c'est le délai de garantie qu'on veut voir à l'œuvre.
  await commande({
    suffixe: '004',
    status: 'DELIVERED',
    lignes: [{ produit: p1!, quantite: 1 }],
    livraison: 1500,
    creeIlYa: 9,
    expedieIlYa: 5,
    livreIlYa: 1,
    suivi: { carrier: 'Poste CI', trackingNumber: 'CI9930014772' },
  });

  // Livrée il y a 20 jours : sortie de garantie, donc réellement versable.
  const versable = await commande({
    suffixe: '005',
    status: 'DELIVERED',
    lignes: [
      { produit: p1!, quantite: 3 },
      { produit: p2!, quantite: 1 },
    ],
    livraison: 1500,
    creeIlYa: 28,
    expedieIlYa: 24,
    livreIlYa: 20,
    suivi: { carrier: 'DHL Côte d’Ivoire', trackingNumber: 'CI2210559034' },
  });

  // Une demande de remboursement partielle en attente, sur cette même commande :
  // le vendeur a ainsi quelque chose à trancher dès sa première visite.
  const dejaDemande = await prisma.refund.findFirst({
    where: { orderId: versable.id, reference: { startsWith: PREFIXE } },
  });
  if (!dejaDemande) {
    const ligne = await prisma.orderItem.findFirst({
      where: { orderId: versable.id },
      orderBy: { quantity: 'desc' },
    });
    if (ligne) {
      const montant = Number(ligne.unitPrice);
      const partPlateforme = Math.round(montant * TAUX);
      await prisma.refund.create({
        data: {
          reference: `${PREFIXE}RB01`,
          orderId: versable.id,
          amount: montant,
          sellerShare: montant - partPlateforme,
          platformShare: partPlateforme,
          shippingShare: 0,
          full: false,
          reason: 'Un article est arrivé avec une couture décousue.',
          items: { create: [{ orderItemId: ligne.id, quantity: 1, amount: montant }] },
        },
      });
    }
  }

  const total = await prisma.order.count({ where: { orderNumber: { startsWith: PREFIXE } } });
  console.log(`✅ Jeu de démonstration prêt : ${total} commandes (préfixe ${PREFIXE}).`);
  console.log('   Connectez-vous en client@odalyan.ai ou vendeur@odalyan.ai (mdp: password123).');
  console.log('   Pour tout retirer : pnpm --filter @odalyan/api db:demo:clean');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
