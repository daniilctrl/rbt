# syntax=docker/dockerfile:1.7
#
# Один Dockerfile, три target'а — producer, consumer, telegram-notifier.
# Зависимости ставятся один раз для всего монорепо, contracts собирается один раз,
# приложения собираются параллельно. BuildKit cache mount сохраняет pnpm store
# между билдами — повторные сборки занимают секунды, а не минуты.

# ============================================================
# 1. Базовый образ с pnpm
# ============================================================
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@8.15.5 --activate
WORKDIR /repo

# ============================================================
# 2. Установка всех зависимостей монорепо (один раз)
# ============================================================
FROM base AS deps

# Сначала только манифесты — слой кэшируется пока package.json'ы не меняются
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/producer/package.json ./apps/producer/
COPY apps/consumer/package.json ./apps/consumer/
COPY apps/telegram-notifier/package.json ./apps/telegram-notifier/
COPY packages/contracts/package.json ./packages/contracts/

# pnpm store кэшируется между билдами через BuildKit cache mount
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile=false

# ============================================================
# 3. Сборка всех пакетов
# ============================================================
FROM deps AS builder

COPY packages/contracts ./packages/contracts
COPY apps ./apps

# Сначала contracts (от него зависят остальные), потом всё остальное.
# pnpm -r --filter '!@app/contracts' соберёт три app'а параллельно если возможно.
RUN pnpm --filter @app/contracts build
RUN pnpm -r --filter '!@app/contracts' build

# ============================================================
# 4. Раннтайм-стейджи — по одному на каждый сервис
# ============================================================
FROM base AS producer
ENV NODE_ENV=production
COPY --from=builder /repo/pnpm-workspace.yaml /repo/package.json /repo/tsconfig.base.json ./
COPY --from=builder /repo/apps/producer/package.json ./apps/producer/
COPY --from=builder /repo/packages/contracts ./packages/contracts
COPY --from=builder /repo/apps/producer/dist ./apps/producer/dist
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --prod --filter producer --frozen-lockfile=false
WORKDIR /repo/apps/producer
EXPOSE 3000
CMD ["node", "dist/main.js"]

FROM base AS consumer
ENV NODE_ENV=production
COPY --from=builder /repo/pnpm-workspace.yaml /repo/package.json /repo/tsconfig.base.json ./
COPY --from=builder /repo/apps/consumer/package.json ./apps/consumer/
COPY --from=builder /repo/packages/contracts ./packages/contracts
COPY --from=builder /repo/apps/consumer/dist ./apps/consumer/dist
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --prod --filter consumer --frozen-lockfile=false
WORKDIR /repo/apps/consumer
EXPOSE 3001
CMD ["node", "dist/main.js"]

FROM base AS telegram-notifier
ENV NODE_ENV=production
COPY --from=builder /repo/pnpm-workspace.yaml /repo/package.json /repo/tsconfig.base.json ./
COPY --from=builder /repo/apps/telegram-notifier/package.json ./apps/telegram-notifier/
COPY --from=builder /repo/packages/contracts ./packages/contracts
COPY --from=builder /repo/apps/telegram-notifier/dist ./apps/telegram-notifier/dist
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --prod --filter telegram-notifier --frozen-lockfile=false
WORKDIR /repo/apps/telegram-notifier
EXPOSE 3002
CMD ["node", "dist/main.js"]
