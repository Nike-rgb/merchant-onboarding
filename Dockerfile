# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
# Bring the compiled app and the files the migration CLI needs at runtime.
COPY --from=build /app/dist ./dist
COPY tsconfig.json ./
EXPOSE 3000
# entrypoint script runs migrations (and seed on first boot) before starting
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
CMD ["./docker-entrypoint.sh"]
