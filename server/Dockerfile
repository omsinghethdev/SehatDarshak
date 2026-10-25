# syntax=docker/dockerfile:1
# SehatDarshak API (Express + Mongoose). Configuration comes only from the environment at runtime
# (see ../.env.example and ../compose.yaml); no .env file or secret is copied into the image.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Production dependencies only, exactly as locked. No dependency needs install scripts.
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=5000
WORKDIR /app
# Root-owned and read-only for the app user: the API never writes to its own files.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

USER node
EXPOSE 5000

# The API connects to MongoDB before it starts listening, so a healthy response also means the
# database connection succeeded at startup.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 5000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

# Node is PID 1's child via the Compose `init` option; server.js closes HTTP and MongoDB on SIGTERM.
CMD ["node", "src/server.js"]
