FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
COPY examples ./examples
RUN npm ci
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages ./packages
COPY examples ./examples
RUN npm ci --omit=dev
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/infrastructure/dist ./packages/infrastructure/dist
COPY --from=builder /app/packages/orchestration/dist ./packages/orchestration/dist
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/web/dist ./packages/web/dist

# uv + mcp-clickhouse for runtime MCP
RUN apk add --no-cache curl bash \
  && curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

EXPOSE 8080
CMD ["node", "packages/api/dist/index.js"]
