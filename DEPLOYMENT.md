# Déploiement en production — Odalyan FashionSphere AI

Ce guide déploie la plateforme (web + API + PostgreSQL + Redis) avec Docker Compose.

## 1. Prérequis (sur le serveur)

- Docker + Docker Compose v2
- Un nom de domaine avec 2 sous-domaines pointant vers le serveur :
  - `votre-domaine.com` → le **web** (port 3000)
  - `api.votre-domaine.com` → l'**API** (port 4000)
- Un reverse proxy HTTPS devant (Nginx, Caddy ou Traefik) pour le TLS/certificats.

## 2. Configuration

```bash
git clone <votre-repo> && cd "FashionSphere AI"
cp .env.prod.example .env.prod
nano .env.prod        # remplir TOUTES les valeurs (voir ci-dessous)
```

Valeurs **obligatoires** à changer dans `.env.prod` :
- `POSTGRES_PASSWORD` — mot de passe fort.
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — secrets aléatoires longs (`openssl rand -base64 48`).
- `WEB_ORIGIN`, `API_PUBLIC_URL`, `NEXT_PUBLIC_API_URL` — vos vraies URLs (HTTPS).
- `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` — clés **live** (`sk_live_…` / `pk_live_…`) une fois le compte Paystack passé en production.

Fortement recommandé en prod : **S3 / Cloudflare R2** (`S3_*`) pour les images importées, sinon elles restent dans le volume `uploads` (non partagé si vous scalez l'API).

## 3. Lancement

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

- Les **migrations Prisma** s'appliquent automatiquement au démarrage de l'API (`prisma migrate deploy`).
- Vérifier : `docker compose -f docker-compose.prod.yml ps` puis `curl http://localhost:4000/api/health`.

## 4. Données initiales

Créer un compte administrateur (une fois les conteneurs démarrés) :

```bash
# Adapter l'email/mot de passe
docker compose -f docker-compose.prod.yml exec -e ADMIN_EMAIL=admin@votre-domaine.com \
  api node -e "require('bcryptjs').hash(process.argv[1],10).then(h=>console.log(h))" 'MotDePasseFort'
```

Ou promouvoir un utilisateur existant via l'admin panel (`/admin`) après une première inscription.

> Note : le seed de démo (`pnpm db:seed`) est destiné au **dev** uniquement — ne pas l'exécuter en prod.

## 5. Reverse proxy (exemple Caddy)

```
votre-domaine.com {
    reverse_proxy localhost:3000
}
api.votre-domaine.com {
    reverse_proxy localhost:4000
}
```

Caddy gère le HTTPS automatiquement. (Nginx/Traefik : équivalent avec certbot / Let's Encrypt.)

## 6. Paiement Paystack en production

1. Finaliser la **« Mise en production »** du compte Paystack (vérification entreprise).
2. Remplacer les clés `sk_test_/pk_test_` par `sk_live_/pk_live_` dans `.env.prod`.
3. **Liste blanche IP** : ajouter l'**IP fixe du serveur** de production dans Paystack → Settings → API Keys & Webhooks (contrairement au dev où on la laisse vide).
4. Configurer un **Webhook** Paystack vers `https://api.votre-domaine.com/api/payments/paystack/verify` si vous voulez la confirmation serveur-à-serveur (sinon la vérification au retour suffit).

## 7. Mises à jour

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

## 8. Sauvegardes

```bash
# Dump de la base
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U odalyan fashionsphere > backup_$(date +%F).sql
```

Penser aussi à sauvegarder le volume `uploads` si vous n'utilisez pas S3.

## Checklist finale avant ouverture au public

- [ ] `.env.prod` rempli, secrets forts, **jamais** committé
- [ ] HTTPS actif sur les 2 domaines
- [ ] `NODE_ENV=production` (défini par le compose)
- [ ] Clés Paystack **live** + IP serveur en liste blanche
- [ ] SMTP configuré (emails de reset fonctionnels)
- [ ] S3/R2 configuré pour les uploads
- [ ] Compte admin créé et mot de passe changé
- [ ] Sauvegarde base de données planifiée
- [ ] `docker compose ... ps` : tous les services `healthy`/`running`
