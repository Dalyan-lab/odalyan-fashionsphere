# syntax=docker/dockerfile:1
# ---- Image API NestJS (monorepo pnpm) ----

FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# openssl requis par le moteur Prisma
RUN corepack enable \
 && apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- Build : install deps + compile shared/api + génère Prisma ----
FROM base AS build
# Manifestes d'abord (cache des couches)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile
# Code source
COPY packages/shared packages/shared
COPY apps/api apps/api
# Compile le package partagé, génère le client Prisma, compile l'API
RUN pnpm --filter @odalyan/shared build \
 && pnpm --filter @odalyan/api exec prisma generate \
 && pnpm --filter @odalyan/api build

# ---- Runtime : n'embarque que ce qui est nécessaire ----
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
# node_modules (avec store .pnpm) + packages liés : les liens symboliques restent valides
# car la structure /app est identique à celle de l'étape build.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/apps/api ./apps/api

WORKDIR /app/apps/api
EXPOSE 4000
# Applique les migrations puis démarre l'API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
