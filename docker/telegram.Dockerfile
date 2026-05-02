# ===== Build stage =====
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@8.15.5 --activate

WORKDIR /repo

COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/telegram-notifier/package.json ./apps/telegram-notifier/
COPY packages/contracts/package.json ./packages/contracts/

RUN pnpm install --frozen-lockfile=false

COPY packages/contracts ./packages/contracts
COPY apps/telegram-notifier ./apps/telegram-notifier

RUN pnpm --filter @app/contracts build
RUN pnpm --filter telegram-notifier build

# ===== Runtime stage =====
FROM node:20-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@8.15.5 --activate

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /repo/pnpm-workspace.yaml /repo/package.json /repo/tsconfig.base.json ./
COPY --from=builder /repo/apps/telegram-notifier/package.json ./apps/telegram-notifier/
COPY --from=builder /repo/packages/contracts ./packages/contracts
COPY --from=builder /repo/apps/telegram-notifier/dist ./apps/telegram-notifier/dist

RUN pnpm install --prod --filter telegram-notifier --frozen-lockfile=false

WORKDIR /app/apps/telegram-notifier

EXPOSE 3002

CMD ["node", "dist/main.js"]
