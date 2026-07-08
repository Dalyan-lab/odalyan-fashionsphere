# syntax=docker/dockerfile:1
# ---- Image Web Next.js (sortie standalone, monorepo pnpm) ----

FROM node:20-bookworm-slim AS base
RUN corepack enable
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ---- Build ----
FROM base AS build
# Variables NEXT_PUBLIC_* : injectées AU BUILD (embarquées dans le bundle client)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
# Manifestes d'abord (cache)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
# Code source + build
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @odalyan/shared build \
 && pnpm --filter @odalyan/web build

# ---- Runtime : serveur Node minimal (standalone) ----
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
# La sortie standalone contient server.js + node_modules tracé + structure monorepo
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
