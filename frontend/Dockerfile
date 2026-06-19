# Debian-based builder so Playwright Chromium (used for static prerendering of
# public marketing routes during `npm run build` → postbuild) installs cleanly.
# The runner stage stays on nginx:alpine, so the shipped image is unaffected.
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
RUN npx playwright install --with-deps chromium
COPY . .
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_API_URL
ARG VITE_SENTRY_DSN
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
