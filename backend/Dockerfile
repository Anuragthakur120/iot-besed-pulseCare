# Stage 1: Dependencies & Builder
FROM node:20-alpine AS dependencies

WORKDIR /app

# Copy root and workspace manifests
COPY package.json package-lock.json ./
COPY database/package.json ./database/
COPY backend/package.json ./backend/

# Install dependencies for database and backend
RUN npm ci --omit=dev --workspace=database --workspace=backend

# Stage 2: Production Minimal Image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Create uploads folder and configure permissions for node non-root user
RUN mkdir -p /app/backend/uploads && chown -R node:node /app

# Copy installed node_modules and sources with non-root ownership
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node --from=dependencies /app/database/node_modules ./database/node_modules
COPY --chown=node:node --from=dependencies /app/backend/node_modules ./backend/node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node database ./database
COPY --chown=node:node backend ./backend

# Non-root user execution
USER node

WORKDIR /app/backend

EXPOSE 5000

# Healthcheck probe against backend readiness endpoint
HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health/ready || exit 1

CMD ["node", "src/server.js"]
