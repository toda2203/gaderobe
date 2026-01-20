#!/bin/bash
#
# Bekleidung App - Update Script
# Safely updates the application to the latest version
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
BACKUP_DIR="$PROJECT_ROOT/backups"

# Logging
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Banner
show_banner() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Bekleidung App - Update Manager         ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
    echo ""
}

# Check if app is running
check_running() {
    cd "$PROJECT_ROOT"
    
    if docker compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        APP_RUNNING=true
        log_info "Application is currently running"
    else
        APP_RUNNING=false
        log_info "Application is not running"
    fi
}

# Create backup
create_backup() {
    log_info "Creating backup before update..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_NAME="pre-update_$TIMESTAMP"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
    
    mkdir -p "$BACKUP_PATH"
    
    # Backup database
    if [ -f "$PROJECT_ROOT/data/bekleidung.db" ]; then
        cp "$PROJECT_ROOT/data/bekleidung.db" "$BACKUP_PATH/bekleidung.db"
        log_success "Database backed up"
    fi
    
    # Backup .env file
    if [ -f "$PROJECT_ROOT/.env" ]; then
        cp "$PROJECT_ROOT/.env" "$BACKUP_PATH/.env"
        log_success ".env file backed up"
    fi
    
    # Backup uploads (optional - can be large)
    read -p "Backup uploads directory? This may take a while for large datasets (y/n) [n]: " backup_uploads
    backup_uploads=${backup_uploads:-n}
    
    if [ "$backup_uploads" = "y" ]; then
        log_info "Backing up uploads... (this may take a while)"
        cp -r "$PROJECT_ROOT/uploads" "$BACKUP_PATH/uploads"
        log_success "Uploads backed up"
    fi
    
    # Create archive
    cd "$BACKUP_DIR"
    tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
    rm -rf "$BACKUP_NAME"
    
    log_success "Backup created: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"
    echo "  Location: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"
    echo ""
}

# Stop application
stop_app() {
    if [ "$APP_RUNNING" = true ]; then
        log_info "Stopping application..."
        cd "$PROJECT_ROOT"
        docker compose -f docker-compose.prod.yml down
        log_success "Application stopped"
    fi
}

# Pull latest code
pull_updates() {
    log_info "Pulling latest code from repository..."
    cd "$PROJECT_ROOT"
    
    # Check if we're in a git repository
    if [ ! -d ".git" ]; then
        log_error "Not a git repository. Cannot pull updates."
        echo "  If you manually copied files, rebuild with: docker compose -f docker-compose.prod.yml build"
        exit 1
    fi
    
    # Save current branch
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    
    # Stash local changes (if any)
    if ! git diff-index --quiet HEAD --; then
        log_warning "Local changes detected. Stashing..."
        git stash
        STASHED=true
    else
        STASHED=false
    fi
    
    # Pull updates
    git pull origin "$CURRENT_BRANCH"
    
    # Show changes
    log_info "Recent commits:"
    git log --oneline -5
    echo ""
    
    log_success "Code updated to latest version"
}

# Update dependencies and rebuild
rebuild_app() {
    log_info "Rebuilding application containers..."
    cd "$PROJECT_ROOT"
    
    # Pull base images
    docker compose -f docker-compose.prod.yml pull
    
    # Rebuild containers
    docker compose -f docker-compose.prod.yml build --no-cache
    
    log_success "Containers rebuilt"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    cd "$PROJECT_ROOT"
    
    # Check if there are pending migrations
    if [ -d "backend/prisma/migrations" ]; then
        # Start backend temporarily for migrations
        docker compose -f docker-compose.prod.yml up -d backend
        
        # Wait for backend to be ready
        sleep 5
        
        # Run migrations in container
        docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
        
        log_success "Migrations complete"
    else
        log_info "No migrations found"
    fi
}

# Start application
start_app() {
    log_info "Starting updated application..."
    cd "$PROJECT_ROOT"
    
    docker compose -f docker-compose.prod.yml up -d
    
    log_success "Application started"
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    # Wait for services to be ready
    sleep 10
    
    cd "$PROJECT_ROOT"
    
    # Check backend health
    if docker compose -f docker-compose.prod.yml exec backend wget --no-check-certificate -q -O - https://localhost:3077/api/health > /dev/null 2>&1; then
        log_success "Backend is healthy"
    else
        log_error "Backend health check failed"
        HEALTH_FAILED=true
    fi
    
    # Check frontend
    if docker compose -f docker-compose.prod.yml ps frontend | grep -q "Up"; then
        log_success "Frontend is running"
    else
        log_error "Frontend is not running"
        HEALTH_FAILED=true
    fi
    
    if [ "${HEALTH_FAILED:-false}" = true ]; then
        log_error "Health check failed!"
        echo ""
        log_warning "Rolling back to backup..."
        rollback
        exit 1
    fi
}

# Rollback to backup
rollback() {
    log_warning "Rolling back to previous version..."
    
    # Find latest backup
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/pre-update_*.tar.gz 2>/dev/null | head -1)
    
    if [ -z "$LATEST_BACKUP" ]; then
        log_error "No backup found for rollback"
        exit 1
    fi
    
    log_info "Restoring from: $LATEST_BACKUP"
    
    # Stop current version
    cd "$PROJECT_ROOT"
    docker compose -f docker-compose.prod.yml down
    
    # Extract backup
    RESTORE_DIR=$(mktemp -d)
    tar -xzf "$LATEST_BACKUP" -C "$RESTORE_DIR"
    BACKUP_NAME=$(basename "$LATEST_BACKUP" .tar.gz)
    
    # Restore database
    if [ -f "$RESTORE_DIR/$BACKUP_NAME/bekleidung.db" ]; then
        cp "$RESTORE_DIR/$BACKUP_NAME/bekleidung.db" "$PROJECT_ROOT/data/bekleidung.db"
        log_success "Database restored"
    fi
    
    # Restore .env
    if [ -f "$RESTORE_DIR/$BACKUP_NAME/.env" ]; then
        cp "$RESTORE_DIR/$BACKUP_NAME/.env" "$PROJECT_ROOT/.env"
        log_success ".env restored"
    fi
    
    # Cleanup
    rm -rf "$RESTORE_DIR"
    
    # Restart application
    docker compose -f docker-compose.prod.yml up -d
    
    log_success "Rollback complete"
}

# Show logs
show_logs() {
    log_info "Recent application logs:"
    cd "$PROJECT_ROOT"
    docker compose -f docker-compose.prod.yml logs --tail=50
}

# Show completion
show_completion() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   Update Complete! 🎉                     ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
    echo ""
    log_info "Application successfully updated to the latest version"
    echo ""
    log_info "Useful commands:"
    echo "  View logs:    docker compose -f docker-compose.prod.yml logs -f"
    echo "  Restart:      docker compose -f docker-compose.prod.yml restart"
    echo "  Stop:         docker compose -f docker-compose.prod.yml down"
    echo "  Status:       docker compose -f docker-compose.prod.yml ps"
    echo ""
}

# Main execution
main() {
    show_banner
    
    # Confirmation
    log_warning "This will update the application to the latest version"
    read -p "Continue with update? (y/n): " confirm
    if [ "$confirm" != "y" ]; then
        log_info "Update cancelled"
        exit 0
    fi
    
    echo ""
    
    check_running
    create_backup
    stop_app
    pull_updates
    rebuild_app
    run_migrations
    start_app
    health_check
    show_completion
}

# Parse arguments
case "${1:-}" in
    --rollback)
        log_warning "Manual rollback requested"
        rollback
        exit 0
        ;;
    --logs)
        show_logs
        exit 0
        ;;
    --help|-h)
        echo "Usage: $(basename "$0") [OPTIONS]"
        echo ""
        echo "OPTIONS:"
        echo "  (no options)    Perform full update with backup"
        echo "  --rollback      Rollback to previous backup"
        echo "  --logs          Show recent application logs"
        echo "  --help, -h      Show this help"
        exit 0
        ;;
    "")
        main
        ;;
    *)
        log_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac
