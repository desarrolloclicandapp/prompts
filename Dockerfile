# ----------------------------------------------------
# STAGE 1: COMPILACIÓN Y BUILD
# ----------------------------------------------------
FROM node:20-alpine AS builder

# Configuración
WORKDIR /app
RUN apk add --no-cache openssl git

# Copiar y instalar dependencias
COPY package*.json ./

# Instalar dependencias (Esto ejecutará prisma generate via postinstall)
RUN npm install

# Copiar el código fuente
COPY prisma ./prisma/
COPY . .

# Ejecutar el build de Next.js
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# ----------------------------------------------------
# STAGE 2: PRODUCCIÓN (Optimizado y Ligero)
# ----------------------------------------------------
FROM node:20-alpine

WORKDIR /app

# Copiar solo los archivos necesarios para la ejecución (mínimo consumo de espacio)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Puerto de la aplicación Next.js
EXPOSE 3000

# Comando de inicio
CMD ["npm", "start"]
