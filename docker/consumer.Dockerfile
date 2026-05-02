# ===== Build stage =====
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@8.15.5 --activate

WORKDIR /repo

COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/consumer/package.json ./apps/consumer/
COPY packages/contracts/package.json ./packages/contracts/

RUN pnpm install --frozen-lockfile=false

COPY packages/contracts ./packages/contracts
COPY apps/consumer ./apps/consumer

RUN pnpm --filter @app/contracts build
RUN pnpm --filter consumer build

# ===== Runtime stage =====
FROM node:20-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@8.15.5 --activate

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /repo/pnpm-workspace.yaml /repo/package.json /repo/tsconfig.base.json ./
COPY --from=builder /repo/apps/consumer/package.json ./apps/consumer/
COPY --from=builder /repo/packages/contracts ./packages/contracts
COPY --from=builder /repo/apps/consumer/dist ./apps/consumer/dist

RUN pnpm install --prod --filter consumer --frozen-lockfile=false

WORKDIR /app/apps/consumer

EXPOSE 3001

CMD ["node", "dist/main.js"]
