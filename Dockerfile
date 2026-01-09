# ----------------------------------------------------
# STAGE 1: BUILD
# ----------------------------------------------------
FROM node:20-slim AS builder

WORKDIR /app

# Dependencias del sistema
RUN apt-get update && apt-get install -y openssl git \
  && rm -rf /var/lib/apt/lists/*

# Copiamos archivos clave
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Instalación estricta
RUN npm ci

# Copiamos el resto del código
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ARG CACHEBUST=1

# Build (Tailwind + Next)
RUN npm run build

# Limpieza
RUN npm prune --production

# ----------------------------------------------------
# STAGE 2: PRODUCCIÓN
# ----------------------------------------------------
FROM node:20-slim

WORKDIR /app

# OpenSSL para Prisma
RUN apt-get update && apt-get install -y openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "start"]
