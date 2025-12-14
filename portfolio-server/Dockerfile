# --------------------
# Build Stage
# --------------------
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Set working directory
WORKDIR /app

# ✅ Copy full source first to ensure workspaces are present
COPY . .

# Set NODE_ENV to production
ENV NODE_ENV=production

# ✅ Install dependencies with workspace awareness
RUN npm ci --omit=dev --legacy-peer-deps

# ✅ Build Strapi (and any plugins if needed)
RUN npm run build

# --------------------
# Final Runtime Stage
# --------------------
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    musl \
    giflib \
    pixman \
    font-noto \
    curl

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S strapi -u 1001

WORKDIR /app

# Copy built app from builder
COPY --from=builder --chown=strapi:nodejs /app /app

# Create necessary folders and set permissions
RUN mkdir -p .tmp/data && \
    mkdir -p public/uploads && \
    chown -R strapi:nodejs .tmp public

USER strapi

# Healthcheck (optional but useful)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:1337/_health || exit 1

EXPOSE 1337

ENV NODE_ENV=production
ENV DATABASE_CLIENT=sqlite
ENV DATABASE_FILENAME=.tmp/data.db

CMD ["npm", "start"]
