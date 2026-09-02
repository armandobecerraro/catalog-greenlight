# Catalog Greenlight — production image (API + static web + mcp-clickhouse via uv)
FROM node:20-bookworm-slim AS builder

WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
COPY examples ./examples
RUN npm ci
RUN npm run build -w @bas/core -w @bas/infrastructure -w @bas/orchestration -w @bas/web -w @bas/api

FROM node:20-bookworm-slim AS runner

# Python 3.11 (Debian) + uv; uv can install Python 3.13 for mcp-clickhouse
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl \
  && curl -LsSf https://astral.sh/uv/install.sh | sh \
  && rm -rf /var/lib/apt/lists/*

ENV PATH="/root/.local/bin:${PATH}"

# Smoke: ensure mcp-clickhouse resolves (uv installs Python 3.13 if needed)
RUN uv run --with mcp-clickhouse --python 3.13 mcp-clickhouse --help

WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/infrastructure/dist ./packages/infrastructure/dist
COPY --from=builder /app/packages/orchestration/dist ./packages/orchestration/dist
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/web/dist ./packages/web/dist

RUN npm ci --omit=dev

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD curl -fsS http://127.0.0.1:${PORT}/api/v1/health || exit 1

CMD ["node", "packages/api/dist/index.js"]
