# ----------------------------------------------------
# STAGE 1: COMPILACIÓN Y BUILD
# ----------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app
# Dependencias del sistema
RUN apk add --no-cache openssl git

# 1. Copiamos archivos clave primero
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# 2. INSTALACIÓN ESTRICTA (¡No cambies esto a npm install!)
# npm ci borra la carpeta node_modules y asegura versiones exactas
RUN npm ci

# 3. Copiamos el resto del código
COPY . .

# 4. Construcción (Este paso fuerza a Tailwind a regenerar el CSS)
ENV NEXT_TELEMETRY_DISABLED 1
# Truco: Cambia el número de abajo si alguna vez necesitas forzar el borrado de caché
ARG CACHEBUST=1 
RUN npm run build

# 5. Limpieza de librerías de desarrollo
RUN npm prune --production

# ----------------------------------------------------
# STAGE 2: PRODUCCIÓN
# ----------------------------------------------------
FROM node:20-alpine

WORKDIR /app

# Instalación de OpenSSL para producción
RUN apk add --no-cache openssl

# Copiar solo lo necesario desde el builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "start"]
