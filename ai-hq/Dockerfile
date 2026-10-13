# syntax=docker/dockerfile:1
#
# AI HQ production image (Next.js standalone server).
# Build:  docker build -t ai-hq:<version> .
# Run:    see docker-compose.yml and docs/DEPLOYMENT.md
#
# No secrets are baked into the image: all configuration is read from the
# environment at runtime, so the same image runs in staging and production.

ARG NODE_IMAGE=node:22-alpine

# ---- dependencies -----------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Dev dependencies are needed for the build; the final image only keeps the
# traced production files from .next/standalone.
# Behind a TLS-inspecting proxy, pass its CA as a build secret (never stored in
# a layer):  docker build --secret id=npm_ca,src=/path/to/ca.pem .
RUN --mount=type=secret,id=npm_ca,required=false \
    if [ -f /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; \
    npm ci --no-audit --no-fund

# ---- build ------------------------------------------------------------------
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx next build

# ---- runtime ----------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Run as the unprivileged "node" user that ships with the official image.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
