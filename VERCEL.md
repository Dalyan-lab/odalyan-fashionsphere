# Déploiement sur Vercel — Odalyan FashionSphere AI

⚠️ **Important : Vercel n'héberge que le _frontend_ (Next.js).** L'API NestJS (serveur long-running + Prisma) et PostgreSQL ne tournent **pas** sur Vercel. Architecture recommandée :

| Composant | Hébergeur | Pourquoi |
|---|---|---|
| **Web (Next.js)** | **Vercel** | Optimisé pour Next.js |
| **API (NestJS)** | **Railway** ou **Render** | Conteneur long-running (le `apps/api/Dockerfile` s'y déploie tel quel) |
| **PostgreSQL** | **Neon** ou **Supabase** | Postgres managé (offre gratuite) |
| **Uploads d'images** | **Cloudflare R2** / **S3** | Vercel & serverless n'ont pas de disque persistant |

---

## Étape 1 — Base de données (Neon)

1. Crée un projet sur [neon.tech](https://neon.tech) → copie la **connection string** (`postgresql://…?sslmode=require`).
2. Garde-la : ce sera `DATABASE_URL` de l'API.

## Étape 2 — API (Railway, exemple)

1. Sur [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**.
2. Réglages du service :
   - **Root Directory** : `/` (racine du repo)
   - **Dockerfile Path** : `apps/api/Dockerfile`
3. Variables d'environnement (onglet Variables) — reprendre celles de [.env.prod.example](.env.prod.example) :
   - `DATABASE_URL` = la string Neon
   - `NODE_ENV=production`, `PORT=4000`
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (aléatoires longs)
   - `WEB_ORIGIN` = l'URL Vercel du web (ex. `https://odalyan.vercel.app`)
   - `API_PUBLIC_URL` = l'URL publique de l'API Railway
   - `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_CURRENCY=XOF`, `PAYSTACK_EUR_RATE=655.957`
   - (optionnel) `SMTP_*`, `S3_*`, `OPENAI_API_KEY`, etc.
4. Railway expose une URL type `https://odalyan-api.up.railway.app`. Les migrations Prisma s'appliquent au démarrage (`prisma migrate deploy`, déjà dans le Dockerfile).

> **Render** : équivalent — New → Web Service → Docker → `apps/api/Dockerfile`, mêmes variables.

## Étape 3 — Web (Vercel)

1. Sur [vercel.com](https://vercel.com) → **Add New → Project** → importe le repo GitHub.
2. **Configure Project** :
   - **Root Directory** : `apps/web` ← important
   - Framework : **Next.js** (auto-détecté)
   - Build/Install : déjà pilotés par [apps/web/vercel.json](apps/web/vercel.json) (build du package partagé inclus).
3. **Environment Variables** (Settings → Environment Variables) :
   | Variable | Valeur |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://<ton-api>.up.railway.app/api` (⚠️ suffixe `/api`) |
   | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | (vide si tu n'utilises pas Stripe) |
4. **Deploy**.

> Ces variables `NEXT_PUBLIC_*` sont **embarquées au build** : après les avoir changées, relance un déploiement (Redeploy).

## Étape 4 — Relier les deux

Une fois les URLs connues, vérifie la cohérence :
- API (Railway) → `WEB_ORIGIN` = l'URL Vercel (pour le CORS).
- Web (Vercel) → `NEXT_PUBLIC_API_URL` = l'URL API Railway + `/api`.
- Paystack → **liste blanche IP** : ajouter l'IP sortante de Railway/Render (ou la laisser vide au début), et clés **live** une fois le compte validé.

## Étape 5 — Compte admin

Après le premier déploiement, promouvoir un compte en ADMIN. Le plus simple : s'inscrire via le site, puis sur Neon exécuter :
```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'ton-email@exemple.com';
```
Puis se connecter et accéder à `/admin`.

---

## Alternative « tout-en-un » (plus simple à gérer)

Si tu préfères éviter 3 fournisseurs : héberge **web + api + postgres sur Railway** (via le `docker-compose.prod.yml`, ou 3 services Railway). Tu perds l'edge CDN de Vercel pour le web, mais la gestion est centralisée. Dis-le moi si tu veux ce montage à la place.
