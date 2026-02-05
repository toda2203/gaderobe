FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install ALL dependencies (build stage needs everything)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY src ./src

# Generate Prisma Client
RUN npx prisma generate

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install SQLite and OpenSSL (Prisma dependency)
RUN apk add --no-cache sqlite openssl

# Copy package files
COPY package*.json ./

# Install ALL dependencies  (needed for runtime)
RUN npm ci --legacy-peer-deps

# Copy built application FROM builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Create directories for data, uploads, backups, logs
RUN mkdir -p /app/data /app/uploads /app/backups /app/logs

# Generate self-signed certificate for HTTPS
RUN openssl req -x509 -newkey rsa:4096 -keyout /tmp/key.pem -out /tmp/cert.pem -days 365 -nodes \
    -subj "/C=DE/ST=NRW/L=Dortmund/O=Autohaus Graupner/CN=10.56.131.165" && \
    openssl pkcs12 -export -out /app/cert.pfx -inkey /tmp/key.pem -in /tmp/cert.pem -passout pass:password123 && \
    rm /tmp/key.pem /tmp/cert.pem

# Set proper permissions
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose port
EXPOSE 3077

# Health check with longer timeout
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD node -e "require('http').get('http://localhost:3077/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
