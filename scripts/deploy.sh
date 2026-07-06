#!/bin/bash

###############################################################################
# External Server Deployment Script
# 
# This script automates the deployment process for external servers (not Vercel)
# 
# Features:
#   - Pulls latest changes from GitHub (main branch)
#   - Validates prerequisites and environment variables
#   - Installs dependencies with pnpm
#   - Builds Next.js application
#   - Starts/restarts PM2 process
#   - Verifies deployment health
# 
# Usage:
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh production
#   ./scripts/deploy.sh staging
#   ./scripts/deploy.sh development
#
# Prerequisites:
#   - Node.js 22.x installed
#   - pnpm installed globally: npm install -g pnpm
#   - PM2 installed globally: npm install -g pm2
#   - Git configured with GitHub SSH keys (for git pull)
#   - .env.local or .env.production.local configured
#   - MongoDB connection available
#   - SSH access to server for deployment
#
###############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
APP_NAME="sandy-app"
APP_DIR=$(pwd)
LOG_DIR="/var/log/sandy"
MAX_RETRIES=3
RETRY_DELAY=5

# ============================================================================
# Helper Functions
# ============================================================================

log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
  echo -e "${RED}✗ $1${NC}"
}

log_section() {
  echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║ $1${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"
}

exit_error() {
  log_error "$1"
  exit 1
}

# ============================================================================
# Validation Functions
# ============================================================================

check_prerequisites() {
  log_section "Checking Prerequisites"

  # Check Node.js
  if ! command -v node &> /dev/null; then
    exit_error "Node.js is not installed"
  fi
  local node_version=$(node --version)
  log_success "Node.js: $node_version"

  # Check pnpm
  if ! command -v pnpm &> /dev/null; then
    exit_error "pnpm is not installed. Install with: npm install -g pnpm"
  fi
  log_success "pnpm installed"

  # Check PM2
  if ! command -v pm2 &> /dev/null; then
    exit_error "PM2 is not installed. Install with: npm install -g pm2"
  fi
  log_success "PM2 installed"

  # Check .env file
  if [ ! -f .env.local ] && [ ! -f .env.production.local ]; then
    exit_error "No .env.local or .env.production.local found. Copy from .env.example and configure."
  fi
  log_success "Environment file found"

  # Create log directory
  if [ ! -d "$LOG_DIR" ]; then
    log_warning "Creating log directory: $LOG_DIR"
    mkdir -p "$LOG_DIR" || exit_error "Failed to create log directory"
  fi
  log_success "Log directory ready"
}

validate_environment() {
  log_section "Validating Environment Variables"

  if [ -f "scripts/validate-env.js" ]; then
    if node scripts/validate-env.js; then
      log_success "Environment variables validated"
    else
      exit_error "Environment variables validation failed"
    fi
  else
    log_warning "Environment validation script not found, skipping"
  fi
}

# ============================================================================
# Git Update
# ============================================================================

pull_latest_changes() {
  log_section "Pulling Latest Changes from GitHub"

  log_info "Current branch: $(git branch --show-current)"
  log_info "Running: git pull origin main"

  if git pull origin main; then
    log_success "Latest changes pulled successfully"
    
    # Show git status
    log_info "Git status:"
    git status --short | head -10
  else
    log_error "Failed to pull latest changes"
    log_warning "Continuing with current code..."
  fi
}

# ============================================================================
# Installation & Build
# ============================================================================

install_dependencies() {
  log_section "Installing Dependencies"

  log_info "Running: pnpm install"
  if pnpm install --frozen-lockfile; then
    log_success "Dependencies installed"
  else
    log_warning "pnpm install failed, retrying..."
    for i in $(seq 1 $MAX_RETRIES); do
      log_info "Retry $i/$MAX_RETRIES..."
      sleep $RETRY_DELAY
      if pnpm install; then
        log_success "Dependencies installed (retry $i)"
        return 0
      fi
    done
    exit_error "Failed to install dependencies after $MAX_RETRIES retries"
  fi
}

build_application() {
  log_section "Building Next.js Application"

  log_info "Building with: pnpm build"
  log_info "This may take several minutes..."
  
  # Clean build artifacts before building to ensure fresh CSS/styles
  log_info "Clearing previous build cache..."
  rm -rf .next/cache 2>/dev/null || true

  if pnpm build 2>&1 | tee build.log; then
    log_success "Build completed successfully"
    
    # Show build output
    if [ -f .next/BUILD_ID ]; then
      log_info "Build ID: $(cat .next/BUILD_ID)"
    fi
    
    # Verify CSS was built
    if find .next -name "*.css" -o -name "*.css.map" | grep -q .; then
      log_success "CSS files compiled successfully"
    else
      log_warning "CSS files not found in build output - may be inlined"
    fi
  else
    exit_error "Build failed. Check build.log and logs above for details."
  fi
}

# ============================================================================
# PM2 Management
# ============================================================================

setup_pm2() {
  log_section "Setting Up PM2"

  # Kill existing process if running to ensure clean start
  log_info "Stopping current PM2 process (if running)..."
  pm2 delete "$APP_NAME" 2>/dev/null || true
  sleep 1

  log_info "Starting application with PM2 (environment: $ENVIRONMENT)..."
  log_info "Using ecosystem.config.js configuration..."
  
  if pm2 start ecosystem.config.js --env "$ENVIRONMENT" 2>&1 | tee pm2-start.log; then
    log_success "PM2 process started successfully"
    sleep 3  # Give app time to start
    
    # Show PM2 status
    log_info "PM2 process status:"
    pm2 status | grep -E "$APP_NAME|Name|Status"
  else
    log_error "Failed to start PM2 process"
    log_warning "Checking PM2 error logs..."
    pm2 logs --err --lines 20
    exit_error "PM2 startup failed"
  fi
}

configure_pm2_startup() {
  log_section "Configuring PM2 Startup"

  if [ "$ENVIRONMENT" = "production" ]; then
    log_info "Setting up PM2 to run on system startup..."
    pm2 save || log_warning "Failed to save PM2 state"
    
    # Note: This requires manual sudoers configuration
    log_warning "To enable auto-startup on system reboot, run:"
    echo -e "  ${YELLOW}sudo env PATH=\$PATH:/usr/local/bin pm2 startup systemd -u \$(whoami) --hp \$(eval echo ~\$(whoami))${NC}"
    echo -e "  ${YELLOW}pm2 save${NC}"
  fi
}

# ============================================================================
# Health Checks
# ============================================================================

wait_for_app_ready() {
  log_section "Waiting for Application to Be Ready"

  local max_attempts=30
  local attempt=1
  local port=${PORT:-5000}

  while [ $attempt -le $max_attempts ]; do
    log_info "Attempt $attempt/$max_attempts - Checking if app is responding..."
    
    if curl -s http://localhost:$port/api/auth/check > /dev/null 2>&1; then
      log_success "Application is ready"
      return 0
    fi
    
    if [ $attempt -lt $max_attempts ]; then
      sleep 2
      ((attempt++))
    else
      break
    fi
  done

  log_warning "Application did not respond within expected time"
  log_info "Check logs with: pm2 logs $APP_NAME"
  return 1
}

# ============================================================================
# Verification & Testing
# ============================================================================

verify_deployment() {
  log_section "Verifying Deployment"

  # Check PM2 status
  echo ""
  log_info "PM2 Process Status:"
  pm2 info "$APP_NAME" || log_warning "PM2 info command failed"

  # Show recent logs
  echo ""
  log_info "Recent Logs (last 10 lines):"
  pm2 logs "$APP_NAME" --lines 10 --nostream || log_warning "Could not fetch logs"

  # Check disk space
  echo ""
  log_info "Disk Space:"
  df -h "$APP_DIR" | tail -1

  # Check memory usage
  echo ""
  log_info "Memory Usage:"
  free -h | grep -E "^Mem|^Swap"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
  echo -e "\n${BLUE}════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}        Sandy Application Deployment Script${NC}"
  echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
  echo -e "Environment: ${YELLOW}${ENVIRONMENT}${NC}"
  echo -e "Directory: ${YELLOW}${APP_DIR}${NC}"
  echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}\n"

  # Validate environment parameter
  if [ "$ENVIRONMENT" != "production" ] && [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "development" ]; then
    exit_error "Invalid environment: $ENVIRONMENT. Use: production, staging, or development"
  fi

  # Execute deployment steps
  check_prerequisites
  pull_latest_changes
  validate_environment
  install_dependencies
  build_application
  setup_pm2
  configure_pm2_startup
  wait_for_app_ready || log_warning "Application ready check failed, continuing..."
  verify_deployment

  echo -e "\n${GREEN}════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}✓ Deployment completed successfully!${NC}"
  echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}\n"

  log_info "Next steps:"
  echo -e "  1. Access application at: http://localhost:5000"
  echo -e "  2. View logs: ${YELLOW}pm2 logs $APP_NAME${NC}"
  echo -e "  3. Check status: ${YELLOW}pm2 status${NC}"
  echo -e "  4. Restart: ${YELLOW}pm2 restart $APP_NAME${NC}"
  echo -e "  5. Setup reverse proxy (Nginx, Apache) for production"
  echo ""
}

# Run main function
main "$@"
