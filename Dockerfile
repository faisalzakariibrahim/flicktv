FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN addgroup -g 1001 -S nodejs && adduser -S flicktv -u 1001
USER flicktv
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["node", "server.js"]
