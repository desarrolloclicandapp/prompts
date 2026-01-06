# ----------------------------------------------------
# STAGE 1: COMPILACIÓN Y BUILD
# ----------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app
# Instalamos dependencias de sistema necesarias
RUN apk add --no-cache openssl git

# 1. Copiamos PRIMERO los archivos de dependencias
# Esto permite a Docker usar la caché si no has cambiado dependencias
COPY package.json package-lock.json ./
# Copiamos la carpeta prisma antes de instalar para que el postinstall funcione
COPY prisma ./prisma/

# 2. INSTALACIÓN BLINDADA (El cambio clave)
# Usamos 'npm ci' en lugar de 'npm install'
RUN npm ci

# 3. Copiamos el resto del código
COPY . .

# 4. Ejecutar el build de Next.js
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# 5. Limpieza para producción
RUN npm prune --production

# ----------------------------------------------------
# STAGE 2: PRODUCCIÓN
# ----------------------------------------------------
FROM node:20-alpine

WORKDIR /app

# Instalación de OpenSSL para producción
RUN apk add --no-cache openssl

# Copiamos los archivos necesarios desde el builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "start"]