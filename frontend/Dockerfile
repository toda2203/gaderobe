FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY tsconfig.node.json ./
COPY vite.config.ts ./

# Install dependencies
RUN npm ci

# Copy source code
COPY index.html ./
COPY src ./src
COPY public ./public

# Build arguments
ARG VITE_API_URL
ARG VITE_AZURE_CLIENT_ID
ARG VITE_AZURE_TENANT_ID
ARG VITE_AZURE_REDIRECT_URI

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_AZURE_CLIENT_ID=$VITE_AZURE_CLIENT_ID
ENV VITE_AZURE_TENANT_ID=$VITE_AZURE_TENANT_ID
ENV VITE_AZURE_REDIRECT_URI=$VITE_AZURE_REDIRECT_URI

# Build application
RUN npm run build

# Production stage - Nginx with SSL support
FROM nginx:alpine

# Install OpenSSL for SSL certificate handling
RUN apk add --no-cache openssl

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create SSL directory
RUN mkdir -p /etc/nginx/ssl

# Expose ports (HTTP and HTTPS)
EXPOSE 80 443

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
