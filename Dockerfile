# syntax=docker/dockerfile:1

############################
# Stage 1: build
############################
FROM node:22-bookworm-slim AS build
WORKDIR /app

# VITE_* vars must be INLINED into the client at `vite build` time. The npm scripts run
# `dotenv -e .env -- vite build` / `... tsc`, so a .env file must exist; the project README
# also warns tsc won't pick up .env on its own, so we additionally export them as ENV here.
ARG VITE_OMSS_API_URL=http://localhost:8080
ARG VITE_TMDB_API_KEY
ARG VITE_STANDALONE=false

# NODE_ENV=production so the vite config's `process.env.NODE_ENV === "production"` branches
# (VitePWA outDir, @fastify/vite write path) resolve correctly — a dev NODE_ENV makes those
# paths undefined and crashes writeBundle. --include=dev forces the build toolchain (vite/tsc)
# to install despite the production env.
ENV VITE_OMSS_API_URL=${VITE_OMSS_API_URL} \
    VITE_TMDB_API_KEY=${VITE_TMDB_API_KEY} \
    VITE_STANDALONE=${VITE_STANDALONE} \
    NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Bring in the source.
COPY . .

# Materialize the .env the build scripts read via dotenv-cli.
RUN printf 'VITE_OMSS_API_URL=%s\nVITE_TMDB_API_KEY=%s\nVITE_STANDALONE=%s\n' \
      "$VITE_OMSS_API_URL" "$VITE_TMDB_API_KEY" "$VITE_STANDALONE" > .env

# build:client (vite build -> build/client, VITE_* inlined) then build:server (tsc -> build/server).
RUN npm run build

############################
# Stage 2: runtime
############################
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# Production-only dependencies (vite, tsc, cross-env, pino-pretty are devDeps, not needed at runtime).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy the WHOLE build tree: build/server (compiled entrypoint) AND build/client
# (what @fastify/vite's distDir points at, incl. .vite/manifest.json + index.html).
COPY --from=build /app/build ./build

EXPOSE 3000

# package.json "start" is `cross-env NODE_ENV=production node build/server/index.js`;
# NODE_ENV is set via ENV above, so we invoke node directly.
CMD ["node", "build/server/index.js"]
