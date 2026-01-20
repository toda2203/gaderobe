#!/bin/bash
#
# SSL Certificate Generator for Bekleidung App
# Supports: Self-signed certificates and Let's Encrypt
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SSL_DIR="$PROJECT_ROOT/ssl"

# Default values
CERT_TYPE="self-signed"
DOMAIN="localhost"
EMAIL=""
CERT_DAYS=365

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --self-signed)
                CERT_TYPE="self-signed"
                shift
                ;;
            --letsencrypt)
                CERT_TYPE="letsencrypt"
                shift
                ;;
            --domain)
                DOMAIN="$2"
                shift 2
                ;;
            --email)
                EMAIL="$2"
                shift 2
                ;;
            --days)
                CERT_DAYS="$2"
                shift 2
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Show help
show_help() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Generate SSL certificates for the Bekleidung App.

OPTIONS:
    --self-signed           Generate self-signed certificate (default)
    --letsencrypt           Use Let's Encrypt for certificate
    --domain DOMAIN         Domain name (default: localhost)
    --email EMAIL           Email for Let's Encrypt notifications
    --days DAYS             Certificate validity days (default: 365)
    --help, -h              Show this help message

EXAMPLES:
    # Self-signed certificate for localhost
    $(basename "$0") --self-signed --domain localhost

    # Self-signed certificate for custom domain
    $(basename "$0") --self-signed --domain bekleidung.company.local --days 730

    # Let's Encrypt certificate (requires public domain)
    $(basename "$0") --letsencrypt --domain app.company.com --email admin@company.com

EOF
}

# Create SSL directory
create_ssl_dir() {
    mkdir -p "$SSL_DIR"
    chmod 700 "$SSL_DIR"
    log_success "SSL directory created: $SSL_DIR"
}

# Generate self-signed certificate
generate_self_signed() {
    log_info "Generating self-signed certificate for $DOMAIN..."
    
    # Create OpenSSL config file
    cat > "$SSL_DIR/openssl.cnf" << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=DE
ST=State
L=City
O=Organization
OU=IT
CN=$DOMAIN

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = localhost
IP.1 = 127.0.0.1
EOF
    
    # Generate private key
    openssl genrsa -out "$SSL_DIR/key.pem" 2048
    
    # Generate certificate signing request
    openssl req -new -key "$SSL_DIR/key.pem" -out "$SSL_DIR/cert.csr" -config "$SSL_DIR/openssl.cnf"
    
    # Generate self-signed certificate
    openssl x509 -req -days "$CERT_DAYS" \
        -in "$SSL_DIR/cert.csr" \
        -signkey "$SSL_DIR/key.pem" \
        -out "$SSL_DIR/cert.pem" \
        -extensions v3_req \
        -extfile "$SSL_DIR/openssl.cnf"
    
    # Generate PFX for backend (Windows compatibility)
    openssl pkcs12 -export \
        -out "$SSL_DIR/cert.pfx" \
        -inkey "$SSL_DIR/key.pem" \
        -in "$SSL_DIR/cert.pem" \
        -passout pass:
    
    # Set permissions
    chmod 600 "$SSL_DIR/key.pem" "$SSL_DIR/cert.pfx"
    chmod 644 "$SSL_DIR/cert.pem"
    
    # Cleanup
    rm -f "$SSL_DIR/cert.csr" "$SSL_DIR/openssl.cnf"
    
    log_success "Self-signed certificate generated successfully"
    echo ""
    log_warning "IMPORTANT: Self-signed certificates will show browser warnings"
    echo "           Users must accept the security exception manually"
    echo ""
    log_info "Certificate details:"
    echo "  Private Key: $SSL_DIR/key.pem"
    echo "  Certificate: $SSL_DIR/cert.pem"
    echo "  PFX (Backend): $SSL_DIR/cert.pfx"
    echo "  Domain: $DOMAIN"
    echo "  Valid for: $CERT_DAYS days"
    echo ""
}

# Generate Let's Encrypt certificate
generate_letsencrypt() {
    log_info "Generating Let's Encrypt certificate for $DOMAIN..."
    
    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        log_info "Installing certbot..."
        if [ -f /etc/debian_version ]; then
            apt-get update
            apt-get install -y certbot
        elif [ -f /etc/redhat-release ]; then
            yum install -y certbot
        else
            log_error "Unsupported OS for automatic certbot installation"
            log_info "Please install certbot manually: https://certbot.eff.org/"
            exit 1
        fi
    fi
    
    # Validate email
    if [ -z "$EMAIL" ]; then
        log_error "Email address is required for Let's Encrypt"
        echo "Use: $(basename "$0") --letsencrypt --domain $DOMAIN --email your@email.com"
        exit 1
    fi
    
    # Generate certificate using standalone mode
    log_warning "This will temporarily bind to port 80. Ensure it's available."
    read -p "Continue? (y/n): " confirm
    if [ "$confirm" != "y" ]; then
        log_info "Cancelled by user"
        exit 0
    fi
    
    certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN"
    
    # Copy certificates to SSL directory
    CERT_PATH="/etc/letsencrypt/live/$DOMAIN"
    
    if [ ! -d "$CERT_PATH" ]; then
        log_error "Certificate generation failed. Check certbot output above."
        exit 1
    fi
    
    # Copy and set permissions
    cp "$CERT_PATH/fullchain.pem" "$SSL_DIR/cert.pem"
    cp "$CERT_PATH/privkey.pem" "$SSL_DIR/key.pem"
    
    # Generate PFX for backend
    openssl pkcs12 -export \
        -out "$SSL_DIR/cert.pfx" \
        -inkey "$SSL_DIR/key.pem" \
        -in "$SSL_DIR/cert.pem" \
        -passout pass:
    
    chmod 600 "$SSL_DIR/key.pem" "$SSL_DIR/cert.pfx"
    chmod 644 "$SSL_DIR/cert.pem"
    
    log_success "Let's Encrypt certificate installed successfully"
    echo ""
    log_info "Certificate details:"
    echo "  Private Key: $SSL_DIR/key.pem"
    echo "  Certificate: $SSL_DIR/cert.pem"
    echo "  PFX (Backend): $SSL_DIR/cert.pfx"
    echo "  Domain: $DOMAIN"
    echo "  Email: $EMAIL"
    echo ""
    log_warning "Let's Encrypt certificates expire in 90 days"
    log_info "Set up automatic renewal with: certbot renew --deploy-hook '$0 --letsencrypt --domain $DOMAIN --email $EMAIL'"
    echo ""
}

# Verify certificates
verify_certificates() {
    log_info "Verifying certificates..."
    
    if [ ! -f "$SSL_DIR/cert.pem" ]; then
        log_error "Certificate file not found: $SSL_DIR/cert.pem"
        exit 1
    fi
    
    if [ ! -f "$SSL_DIR/key.pem" ]; then
        log_error "Private key file not found: $SSL_DIR/key.pem"
        exit 1
    fi
    
    if [ ! -f "$SSL_DIR/cert.pfx" ]; then
        log_error "PFX file not found: $SSL_DIR/cert.pfx"
        exit 1
    fi
    
    # Check certificate validity
    log_info "Certificate information:"
    openssl x509 -in "$SSL_DIR/cert.pem" -noout -text | grep -E "(Subject:|Not Before|Not After|DNS:)"
    
    log_success "Certificate verification complete"
}

# Main
main() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   SSL Certificate Generator               ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
    echo ""
    
    parse_args "$@"
    create_ssl_dir
    
    case $CERT_TYPE in
        self-signed)
            generate_self_signed
            ;;
        letsencrypt)
            generate_letsencrypt
            ;;
        *)
            log_error "Invalid certificate type: $CERT_TYPE"
            exit 1
            ;;
    esac
    
    verify_certificates
    
    echo ""
    log_success "SSL setup complete!"
    echo ""
}

main "$@"
