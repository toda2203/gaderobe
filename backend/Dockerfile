FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Generate Prisma Client
RUN npx prisma generate

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install SQLite
RUN apk add --no-cache sqlite

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Create directories for data, uploads, backups, logs
RUN mkdir -p /app/data /app/uploads /app/backups /app/logs

# Copy SSL certificate if exists (will be mounted as volume in production)
# Certificate will be provided at runtime via volume mount

# Set proper permissions
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose port
EXPOSE 3077

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('https').get({hostname:'localhost',port:3077,path:'/api/health',rejectUnauthorized:false},(r)=>{process.exit(r.statusCode===200?0:1)})"

# Start application
CMD ["node", "dist/server.js"]# Start application
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
