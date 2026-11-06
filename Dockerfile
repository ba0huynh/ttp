# ---- Build stage ----
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Migration tooling stage ----
# The app bundle needs no node_modules, but `src/db/migrate.ts` does: it runs
# through tsx and uses drizzle-orm + mysql2 (prod deps) and dotenv (dev dep).
FROM node:22-slim AS migrate-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && npm install --no-save --no-package-lock tsx dotenv

# ---- Runtime stage ----
# The Nitro build in dist is self-contained (traced deps live in
# dist/server/node_modules); node_modules here only serves the migration runner.
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=migrate-deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json tsconfig.json ./
COPY --chown=node:node src/db ./src/db

USER node
EXPOSE 3000

# Every deploy applies pending migrations first (idempotent: applied ones are
# skipped) and only starts the app when they succeed. Refuse to run without
# explicit DB settings: src/db/index.ts falls back to a hard-coded dev server.
CMD ["sh", "-c", "[ -n \"$DB_HOST\" ] && [ -n \"$DB_NAME\" ] || { echo 'DB_HOST / DB_NAME not set: refusing to run migrations'; exit 1; }; node_modules/.bin/tsx src/db/migrate.ts && exec node dist/server/index.mjs"]
