import { PrismaClient, ProductCategory, ProductStatus, SubscriptionPlan, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  // Vendeur de démo + sa boutique
  const seller = await prisma.user.upsert({
    where: { email: 'vendeur@odalyan.ai' },
    update: {},
    create: {
      email: 'vendeur@odalyan.ai',
      passwordHash,
      firstName: 'Awa',
      lastName: 'Diop',
      role: UserRole.SELLER,
    },
  });

  const shop = await prisma.shop.upsert({
    where: { ownerId: seller.id },
    update: {},
    create: {
      name: 'Maison Diop',
      slug: 'maison-diop',
      slogan: 'La mode africaine réinventée',
      description: 'Créations premium mêlant tradition et innovation.',
      primaryColor: '#C9A227',
      secondaryColor: '#6D28D9',
      ownerId: seller.id,
      subscription: { create: { plan: SubscriptionPlan.PRO } },
    },
  });

  // Client de démo
  await prisma.user.upsert({
    where: { email: 'client@odalyan.ai' },
    update: {},
    create: {
      email: 'client@odalyan.ai',
      passwordHash,
      firstName: 'Liam',
      lastName: 'Martin',
      role: UserRole.CUSTOMER,
    },
  });

  // Quelques produits
  const products = [
    {
      name: 'Boubou Royal Brodé',
      category: ProductCategory.HOMME,
      price: 189.0,
      images: ['https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800'],
    },
    {
      name: 'Robe Wax Élégance',
      category: ProductCategory.FEMME,
      price: 129.0,
      images: ['https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800'],
    },
    {
      name: 'Ensemble Sport Tech',
      category: ProductCategory.SPORT,
      price: 79.0,
      images: ['https://images.unsplash.com/photo-1483721310020-03333e577078?w=800'],
    },
  ];

  for (const p of products) {
    const existing = await prisma.product.findFirst({ where: { name: p.name, shopId: shop.id } });
    if (existing) continue;
    await prisma.product.create({
      data: {
        ...p,
        currency: 'EUR',
        status: ProductStatus.ACTIVE,
        shopId: shop.id,
        variants: {
          create: [
            { size: 'M', color: 'Or', stock: 10 },
            { size: 'L', color: 'Or', stock: 5 },
          ],
        },
      },
    });
  }

  console.log('✅ Seed terminé. Comptes : vendeur@odalyan.ai / client@odalyan.ai (mdp: password123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
