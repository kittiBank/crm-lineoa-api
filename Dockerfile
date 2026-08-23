# syntax=docker/dockerfile:1

# ── Build ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Download only the Alpine/OpenSSL 3 engine — extra binaries blow disk on small EC2 hosts.
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x

COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Compile native addons (bcrypt), then drop the toolchain so nest build has room.
RUN apk add --no-cache libc6-compat openssl python3 make g++ \
  && npm ci \
  && npx prisma generate \
  && apk del python3 make g++ \
  && npm cache clean --force

COPY . .

# prisma stays after prune (production dependency for migrate deploy).
# Re-installing it here previously filled the disk (ENOSPC) and failed the build.
RUN npm run build \
  && npm prune --omit=dev \
  && npm cache clean --force \
  && rm -rf /tmp/* /root/.npm

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat openssl dumb-init \
  && addgroup -S app && adduser -S app -G app

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder --chown=app:app /app/package.json ./
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/prisma ./prisma
COPY --chown=app:app docker/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER app

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--", "docker-entrypoint.sh"]
# Override in compose for worker: ["node", "dist/worker/main.js"]
CMD ["node", "dist/main.js"]
