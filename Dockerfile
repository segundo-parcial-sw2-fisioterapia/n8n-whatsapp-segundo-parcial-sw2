# Etapa de construcción
FROM node:22-alpine AS builder

WORKDIR /app

# Habilitar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Instalar dependencias
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copiar el código fuente y compilar
COPY . .
RUN pnpm run build

# Etapa de producción
FROM node:22-alpine

WORKDIR /app

# Habilitar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Instalar solo dependencias de producción
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Copiamos la compilación generada
COPY --from=builder /app/dist ./dist

# Copiamos el archivo .env
COPY .env .env

# Exponemos el puerto 3003 (Bridge)
EXPOSE 3003

# Comando de inicio
CMD ["node", "dist/main"]
