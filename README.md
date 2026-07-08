# Odalyan FashionSphere AI™

> Créez, animez, exposez et vendez avec la puissance de l'IA.

SaaS de **Fashion Commerce IA** : chaque vendeur crée sa boutique de mode, et l'IA
génère mannequins, essayage virtuel, défilés 3D, vidéos et publicités à partir d'une
simple photo de vêtement.

Ce dépôt contient la **Phase 1 — MVP** (fondations) : authentification, boutiques
vendeurs, catalogue produits, marketplace, panier et paiement.

## 🏗️ Architecture (monorepo)

```
.
├─ apps/
│  ├─ web/   → Frontend Next.js 15 (App Router, React 19, Tailwind, Framer Motion)
│  └─ api/   → Backend NestJS 10 (REST, Prisma, PostgreSQL, JWT, Stripe)
├─ packages/
│  └─ shared/ → Types & schémas Zod partagés (DTO, enums)
└─ docker-compose.yml → PostgreSQL + Redis
```

## 🚀 Démarrage

### Prérequis
- Node.js ≥ 20 (testé sur Node 24)
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- PostgreSQL (via Docker : `docker compose up -d`, ou une instance locale)

### Installation
```bash
pnpm install
```

### Base de données
```bash
# 1. Lancer PostgreSQL (si Docker installé)
docker compose up -d

# 2. Générer le client + appliquer le schéma
pnpm db:generate
pnpm db:migrate

# 3. (Optionnel) Données de démonstration
pnpm db:seed
```

> Comptes de démo après seed : `vendeur@odalyan.ai` / `client@odalyan.ai` — mot de passe `password123`.

### Lancer en développement
```bash
pnpm dev          # lance web (:3000) + api (:4000) via Turborepo
```

- Frontend : http://localhost:3000
- API : http://localhost:4000/api (santé : `/api/health`)

## 🔑 Variables d'environnement

- `apps/api/.env` — voir `apps/api/.env.example` (DB, JWT, Stripe…)
- `apps/web/.env.local` — `NEXT_PUBLIC_API_URL`

Stripe est **optionnel** : sans `STRIPE_SECRET_KEY`, les paiements sont simulés (mode dev).

## 📦 Endpoints principaux (REST)

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Inscription |
| POST | `/api/auth/login` | Connexion |
| GET | `/api/auth/me` | Profil courant |
| GET | `/api/products` | Marketplace (filtres + pagination) |
| GET | `/api/products/:id` | Fiche produit |
| POST | `/api/products` | Créer un produit (vendeur) |
| GET | `/api/shops/public/:slug` | Vitrine de marque |
| POST | `/api/shops` | Créer sa boutique (vendeur) |
| POST | `/api/orders/checkout` | Commander + payer |
| POST | `/api/payments/stripe/webhook` | Webhook Stripe |

## 🗺️ Roadmap

- ✅ **Phase 1 (MVP)** : Auth, boutique, catalogue, marketplace, paiement *(ce dépôt)*
- ⬜ **Phase 2** : Avatar IA, Mannequin IA, Studio Photo IA
- ⬜ **Phase 3** : Avatar 3D, Essayage virtuel, Défilé 3D
- ⬜ **Phase 4** : Vidéo IA, Influenceur IA, Publicité automatique
- ⬜ **Phase 5** : Réseaux sociaux, marketplace internationale, app mobile
