# syntax=docker/dockerfile:1
# SehatDarshak web app: built with Vite, served by an unprivileged Nginx that also forwards /api/
# to the backend service (see nginx/default.conf).
#
# VITE_* values are fixed at BUILD time (Vite writes them into the JavaScript bundle); changing
# them later in the container environment has no effect. They are public, never secrets.

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Where the browser calls the API. "/api" = the same origin, through this image's Nginx.
ARG VITE_API_BASE_URL=/api
# Public address used to print the demo QR codes on /qr-codes (optional; defaults to the
# address the app is opened at).
ARG VITE_PUBLIC_APP_URL=
# Optional fallback for simulated waiting estimates (see client/.env.example).
ARG VITE_QUEUE_AVERAGE_SERVICE_MINUTES=
# Always the real API: the container image can never be built in mock mode.
ENV VITE_AUTH_MODE=api \
    VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_PUBLIC_APP_URL=${VITE_PUBLIC_APP_URL} \
    VITE_QUEUE_AVERAGE_SERVICE_MINUTES=${VITE_QUEUE_AVERAGE_SERVICE_MINUTES}
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
