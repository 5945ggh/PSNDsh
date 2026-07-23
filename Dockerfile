FROM node:20-bookworm-slim AS base

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.2.2 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN corepack pnpm build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack pnpm install --prod --frozen-lockfile

FROM base AS runner

ENV NODE_ENV=production

RUN groupadd --system --gid 1001 app \
  && useradd --system --uid 1001 --gid app app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

RUN mkdir -p /app/data && chown -R app:app /app

USER app
EXPOSE 3000

CMD ["corepack", "pnpm", "start"]
