# syntax=docker/dockerfile:1
#
# Multi-stage build:
#   1. "frontend" stage builds the React app into static files.
#   2. "runtime" stage contains only Node.js, the backend's production
#      dependencies, the backend code and the built frontend.
# The final image therefore has no build tools, dev dependencies or tests.

FROM node:24-alpine AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY backend/src ./src
COPY backend/scripts ./scripts
COPY --from=frontend /build/frontend/dist ./public

# Writable folder for the optional local JSON database (DB_DRIVER=local).
RUN mkdir -p /app/data && chown node:node /app/data

# The Git commit SHA is passed in by the CI pipeline and reported by
# GET /api/health, which lets the pipeline confirm the new version is live.
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}

# Run as the unprivileged "node" user instead of root.
USER node

# Elastic Beanstalk forwards traffic from nginx (port 80) to this port.
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/health > /dev/null || exit 1

CMD ["node", "src/server.js"]
