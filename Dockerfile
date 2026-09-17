# syntax=docker/dockerfile:1.7

ARG BUN_VERSION=1.4.2

FROM oven/bun:${BUN_VERSION} AS dependencies

WORKDIR /app

# These files will be supplied when the Bun application skeleton is created.
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

FROM oven/bun:${BUN_VERSION} AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json bun.lock* ./
COPY src ./src

USER bun
EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
