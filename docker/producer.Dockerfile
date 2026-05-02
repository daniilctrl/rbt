# ===== Build stage =====
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@8.15.5 --activate

WORKDIR /repo

# Копируем только манифесты для лучшего кэширования
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/producer/package.json ./apps/producer/
COPY packages/contracts/package.json ./packages/contracts/

RUN pnpm install --frozen-lockfile=false

# Копируем исходники
COPY packages/contracts ./packages/contracts
COPY apps/producer ./apps/producer

# Сначала собираем общий contracts-пакет (его dist нужен для типов app'а),
# потом сам сервис.
RUN pnpm --filter @app/contracts build
RUN pnpm --filter producer build

# ===== Runtime stage =====
FROM node:20-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@8.15.5 --activate

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /repo/pnpm-workspace.yaml /repo/package.json /repo/tsconfig.base.json ./
COPY --from=builder /repo/apps/producer/package.json ./apps/producer/
COPY --from=builder /repo/packages/contracts ./packages/contracts
COPY --from=builder /repo/apps/producer/dist ./apps/producer/dist

RUN pnpm install --prod --filter producer --frozen-lockfile=false

WORKDIR /app/apps/producer

EXPOSE 3000

CMD ["node", "dist/main.js"]
