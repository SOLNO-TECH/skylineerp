# Skyline ERP — API Express + SPA en /dist (mismo origen: /api, /uploads, rutas React).
# Dokploy: publicar puerto (PORT, default 3000), JWT_SECRET obligatorio.
# Persistencia: montar volúmenes en /app/server/data (BD) y /app/server/uploads — no en todo /app/server.

FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:22-alpine AS runner
RUN apk add --no-cache python3 make g++
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/ ./
WORKDIR /app
COPY --from=frontend-build /app/dist ./dist
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
WORKDIR /app/server
CMD ["node", "index.js"]
