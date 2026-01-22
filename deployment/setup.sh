#!/bin/bash
#
# Bekleidung App - Automated Setup Script
# Version: 1.0
# 
# This script automates the installation of the Bekleidung App on a new server.
# Supports: Debian, Ubuntu, CentOS, RHEL
#

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Logging
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Banner
show_banner() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Bekleidung App - Automated Installer    ║${NC}"
    echo -e "${BLUE}║   Version 1.0                              ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
    echo ""
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_warning "Running as root. Consider using a non-root user with sudo."
    fi
}

# Detect OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
    else
        log_error "Cannot detect OS. /etc/os-release not found."
        exit 1
    fi
    log_info "Detected OS: $OS $OS_VERSION"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_warning "Docker not found. Will install Docker."
        INSTALL_DOCKER=true
    else
        DOCKER_VERSION=$(docker --version | awk '{print $3}' | tr -d ',')
        log_success "Docker found: $DOCKER_VERSION"
        INSTALL_DOCKER=false
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_warning "Docker Compose not found. Will install Docker Compose."
        INSTALL_COMPOSE=true
    else
        log_success "Docker Compose found"
        INSTALL_COMPOSE=false
    fi
    
    # Check Git
    if ! command -v git &> /dev/null; then
        log_warning "Git not found. Installing git..."
        install_git
    else
        log_success "Git found"
    fi
}

# Install Git
install_git() {
    case $OS in
        ubuntu|debian)
            apt-get update && apt-get install -y git
            ;;
        centos|rhel)
            yum install -y git
            ;;
        *)
            log_error "Unsupported OS for automatic git installation: $OS"
            exit 1
            ;;
    esac
}

# Install Docker
install_docker() {
    if [ "$INSTALL_DOCKER" = false ]; then
        return
    fi
    
    log_info "Installing Docker..."
    
    case $OS in
        ubuntu|debian)
            # Install Docker on Debian/Ubuntu
            apt-get update
            apt-get install -y ca-certificates curl gnupg lsb-release
            
            # Add Docker's official GPG key
            install -m 0755 -d /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            chmod a+r /etc/apt/keyrings/docker.gpg
            
            # Add repository
            echo \
              "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS \
              $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
            
            # Install Docker Engine
            apt-get update
            apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        centos|rhel)
            # Install Docker on CentOS/RHEL
            yum install -y yum-utils
            yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            systemctl start docker
            systemctl enable docker
            ;;
        *)
            log_error "Unsupported OS for Docker installation: $OS"
            exit 1
            ;;
    esac
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    log_success "Docker installed successfully"
}

# Customer configuration
setup_customer_config() {
    log_info "Setting up customer configuration..."
    echo ""
    
    # Customer name
    read -p "Customer/Company Name: " CUSTOMER_NAME
    CUSTOMER_NAME=${CUSTOMER_NAME:-"Bekleidung Customer"}
    
    # Hostname/Domain
    read -p "Server Hostname or Domain (e.g., bekleidung.customer.local): " APP_HOST
    APP_HOST=${APP_HOST:-"localhost"}
    
    # Ports
    read -p "Frontend Port [3078]: " FRONTEND_PORT
    FRONTEND_PORT=${FRONTEND_PORT:-3078}
    
    read -p "Backend Port [3077]: " BACKEND_PORT
    BACKEND_PORT=${BACKEND_PORT:-3077}
    
    # Generate JWT Secret
    JWT_SECRET=$(openssl rand -hex 32)
    
    log_success "Configuration collected"
    echo ""
    echo "  Customer: $CUSTOMER_NAME"
    echo "  Host: $APP_HOST"
    echo "  Frontend Port: $FRONTEND_PORT"
    echo "  Backend Port: $BACKEND_PORT"
    echo ""
}

# Generate .env file
generate_env_file() {
    log_info "Generating .env file..."
    
    ENV_FILE="$PROJECT_ROOT/.env"
    
    cat > "$ENV_FILE" << EOF
# ========================================
# CUSTOMER CONFIGURATION
# Generated: $(date)
# ========================================
CUSTOMER_NAME=$CUSTOMER_NAME
APP_HOST=$APP_HOST
FRONTEND_PORT=$FRONTEND_PORT
BACKEND_PORT=$BACKEND_PORT

# ========================================
# APPLICATION SETTINGS
# ========================================
NODE_ENV=production
PORT=$BACKEND_PORT
HOST=0.0.0.0

# ========================================
# DATABASE
# ========================================
DATABASE_URL=file:./data/bekleidung.db

# ========================================
# MICROSOFT ENTRA ID
# TODO: Configure in Azure Portal and update these values
# ========================================
AZURE_TENANT_ID=YOUR-TENANT-ID-HERE
AZURE_CLIENT_ID=YOUR-CLIENT-ID-HERE
AZURE_CLIENT_SECRET=YOUR-CLIENT-SECRET-HERE
AZURE_REDIRECT_URI=https://$APP_HOST:$FRONTEND_PORT/auth/callback

# ========================================
# SECURITY
# ========================================
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# ========================================
# EMAIL CONFIGURATION (SMTP)
# TODO: Update with customer SMTP settings
# ========================================
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=edv@customer.de
SMTP_PASS=YOUR-SMTP-PASSWORD
SMTP_FROM="Garderobe System <edv@customer.de>"

# ========================================
# FILE STORAGE
# ========================================
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/webp

# ========================================
# BACKUP
# ========================================
BACKUP_DIR=./backups
BACKUP_RETENTION_DAYS=30

# ========================================
# LOGGING
# ========================================
LOG_LEVEL=info
LOG_DIR=./logs

# ========================================
# CORS
# ========================================
CORS_ORIGIN=http://localhost
EOF
    
    log_success ".env file created at $ENV_FILE"
    log_warning "IMPORTANT: Edit .env file to configure Azure Entra ID and SMTP settings"
}

# SSL Certificate setup
setup_ssl() {
    log_info "SSL Certificate Setup"
    echo ""
    echo "Choose SSL certificate option:"
    echo "  1) Generate self-signed certificate (quick, browser warning)"
    echo "  2) Use Let's Encrypt (free, trusted, requires public domain)"
    echo "  3) I will provide my own certificate files"
    echo ""
    read -p "Choice [1]: " SSL_CHOICE
    SSL_CHOICE=${SSL_CHOICE:-1}
    
    case $SSL_CHOICE in
        1)
            log_info "Generating self-signed certificate..."
            bash "$SCRIPT_DIR/generate-ssl.sh" --self-signed --domain "$APP_HOST"
            ;;
        2)
            log_info "Setting up Let's Encrypt certificate..."
            read -p "Email for Let's Encrypt notifications: " LE_EMAIL
            bash "$SCRIPT_DIR/generate-ssl.sh" --letsencrypt --domain "$APP_HOST" --email "$LE_EMAIL"
            ;;
        3)
            log_warning "Please place the following files in $PROJECT_ROOT/ssl/:"
            echo "  - cert.pfx (for backend)"
            echo "  - cert.pem (certificate for frontend)"
            echo "  - key.pem (private key for frontend)"
            read -p "Press ENTER when certificates are ready..." 
            ;;
        *)
            log_error "Invalid choice"
            exit 1
            ;;
    esac
    
    log_success "SSL setup complete"
}

# Create required directories
create_directories() {
    log_info "Creating required directories..."
    
    cd "$PROJECT_ROOT"
    
    mkdir -p data
    mkdir -p uploads/clothing-images
    mkdir -p uploads/protocols
    mkdir -p backups
    mkdir -p logs
    mkdir -p ssl
    
    # Set permissions
    chmod 755 data uploads backups logs ssl
    
    log_success "Directories created"
}

# Initialize database
init_database() {
    log_info "Initializing database..."
    
    cd "$PROJECT_ROOT/backend"
    
    # Generate Prisma client
    npx prisma generate
    
    # Run migrations
    npx prisma migrate deploy
    
    log_success "Database initialized"
}

# Build and start application
deploy_application() {
    log_info "Building and starting application..."
    
    cd "$PROJECT_ROOT"

    # Enable BuildKit for faster npm installs
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1

    # Build containers (pull base images)
    docker compose -f docker-compose.prod.yml build --pull
    
    # Start containers
    docker compose -f docker-compose.prod.yml up -d

    # Run migrations inside backend container (SQLite file is volume-mounted)
    log_info "Running database migrations..."
    docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy || true
    
    log_success "Application deployed successfully"
}

# Show completion message
show_completion() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   Installation Complete! 🎉                ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
    echo ""
    log_info "Application URLs:"
    echo "  Frontend: https://$APP_HOST:$FRONTEND_PORT"
    echo "  Backend:  https://$APP_HOST:$BACKEND_PORT"
    echo ""
    log_warning "IMPORTANT: Next Steps"
    echo ""
    echo "1. Edit .env file with Azure Entra ID credentials:"
    echo "   nano $PROJECT_ROOT/.env"
    echo ""
    echo "2. Register redirect URI in Azure Portal:"
    echo "   https://$APP_HOST:$FRONTEND_PORT/auth/callback"
    echo ""
    echo "3. Restart application to apply changes:"
    echo "   cd $PROJECT_ROOT"
    echo "   docker compose -f docker-compose.prod.yml restart"
    echo ""
    echo "4. Check application logs:"
    echo "   docker compose -f docker-compose.prod.yml logs -f"
    echo ""
    echo "5. Access the application:"
    echo "   https://$APP_HOST:$FRONTEND_PORT"
    echo ""
    log_info "For troubleshooting, see: $PROJECT_ROOT/docs/TROUBLESHOOTING.md"
    echo ""
}

# Main execution flow
main() {
    show_banner
    check_root
    detect_os
    check_prerequisites
    install_docker
    setup_customer_config
    create_directories
    generate_env_file
    setup_ssl
    deploy_application
    show_completion
}

# Run main function
main "$@"
