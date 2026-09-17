# syntax=docker/dockerfile:1.7

ARG BUN_VERSION=1.4.2

FROM oven/bun:${BUN_VERSION} AS dependencies

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:${BUN_VERSION} AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV MONITOR_STATE_DB_PATH=/data/state/monitor.sqlite

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json bun.lock* ./
COPY src ./src
COPY scripts ./scripts
COPY migrations ./migrations
RUN mkdir -p /data/state && chown -R bun:bun /data

USER bun
EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
