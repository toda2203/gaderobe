# Bekleidung App - Installation Guide

Complete guide for installing the Bekleidung App on a fresh Debian/Ubuntu server.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation Methods](#installation-methods)
3. [Quick Installation (Recommended)](#quick-installation-recommended)
4. [Manual Installation](#manual-installation)
5. [Post-Installation Configuration](#post-installation-configuration)
6. [SSL Certificate Setup](#ssl-certificate-setup)
7. [Azure Entra ID Configuration](#azure-entra-id-configuration)
8. [First Login](#first-login)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Server Requirements

- **OS**: Debian 11/12, Ubuntu 20.04/22.04/24.04, or compatible Linux distribution
- **RAM**: Minimum 2 GB (4 GB recommended)
- **Disk**: Minimum 20 GB free space
- **CPU**: 2 cores minimum
- **Network**: Internet access for Docker image download

### Required Accounts

1. **Microsoft Entra ID** (formerly Azure AD)
   - Tenant ID
   - Application registration with client ID and secret
   - Redirect URI configured

2. **SMTP Email Account** (for notifications)
   - Office 365, Gmail, or custom SMTP server
   - Username and password

---

## Installation Methods

### Option A: Quick Installation (Recommended)

Automated one-command installation using the setup script.

### Option B: Manual Installation

Step-by-step manual installation for advanced users.

---

## Quick Installation (Recommended)

### Step 1: Clone Repository

```bash
# Install git if not already installed
sudo apt update
sudo apt install -y git

# Clone the repository
git clone https://github.com/toda2203/gaderobe.git
cd gaderobe
```

### Step 2: Make Scripts Executable

```bash
chmod +x deployment/*.sh
```

### Step 3: Run Installation Script

```bash
sudo ./deployment/setup.sh
```

The script will:
1. ✅ Check and install Docker if needed
2. ✅ Prompt for customer configuration (domain, ports)
3. ✅ Generate `.env` file with secure defaults
4. ✅ Setup SSL certificates (self-signed or Let's Encrypt)
5. ✅ Create required directories
6. ✅ Build and start Docker containers
7. ✅ Display access URLs and next steps

### Step 4: Follow Post-Installation Steps

See [Post-Installation Configuration](#post-installation-configuration) below.

---

## Manual Installation

### Step 1: Install Docker

#### Debian/Ubuntu

```bash
# Update package index
sudo apt update

# Install dependencies
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/$(lsb_release -is | tr '[:upper:]' '[:lower:]')/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/$(lsb_release -is | tr '[:upper:]' '[:lower:]') \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Verify installation
docker --version
docker compose version
```

### Step 2: Clone Repository

```bash
git clone https://github.com/toda2203/gaderobe.git
cd gaderobe
```

### Step 3: Configure Environment

```bash
# Copy template
cp deployment/.env.template .env

# Edit with your settings
nano .env
```

Update the following values:

```env
# Customer info
CUSTOMER_NAME=Your Company Name
APP_HOST=your-server.domain.com
FRONTEND_PORT=3078
BACKEND_PORT=3077

# Azure Entra ID (get from Azure Portal)
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_REDIRECT_URI=https://your-server.domain.com:3078/auth/callback

# Generate secure JWT secret
JWT_SECRET=$(openssl rand -hex 32)

# SMTP settings
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@company.com
SMTP_PASS=your-password
SMTP_FROM="Garderobe System <your-email@company.com>"
```

### Step 4: Generate SSL Certificates

```bash
chmod +x deployment/generate-ssl.sh

# Option 1: Self-signed certificate (quick, browser warning)
./deployment/generate-ssl.sh --self-signed --domain your-server.domain.com

# Option 2: Let's Encrypt (free, trusted, requires public domain)
./deployment/generate-ssl.sh --letsencrypt \
  --domain your-server.domain.com \
  --email admin@company.com
```

### Step 5: Create Directories

```bash
mkdir -p data uploads/clothing-images uploads/protocols backups logs ssl
chmod 755 data uploads backups logs ssl
```

### Step 6: Build and Start

```bash
# Build containers
docker compose -f docker-compose.prod.yml build

# Start application
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

---

## Post-Installation Configuration

### 1. Verify Application is Running

```bash
# Check container status
docker compose -f docker-compose.prod.yml ps

# Expected output:
# NAME                STATUS              PORTS
# bekleidung-backend  Up (healthy)        0.0.0.0:3077->3077/tcp
# bekleidung-frontend Up                  0.0.0.0:3078->443/tcp
```

### 2. Access the Application

Open browser: `https://your-server:3078`

**Note**: If using self-signed certificate, accept the security warning.

### 3. Configure Azure Entra ID

See [Azure Entra ID Configuration](#azure-entra-id-configuration) section.

### 4. Set Initial Admin User

```bash
# SSH into backend container
docker compose -f docker-compose.prod.yml exec backend sh

# Set user as admin
node scripts/set-admin.js user@company.com

# Exit container
exit
```

---

## SSL Certificate Setup

### Self-Signed Certificates (Development/Testing)

**Pros:**
- ✅ Quick setup
- ✅ No external dependencies
- ✅ Works offline

**Cons:**
- ❌ Browser security warnings
- ❌ Not trusted by default
- ❌ Users must manually accept

```bash
./deployment/generate-ssl.sh --self-signed --domain your-server.local --days 365
```

### Let's Encrypt (Production)

**Pros:**
- ✅ Free and trusted
- ✅ No browser warnings
- ✅ Auto-renewable

**Cons:**
- ❌ Requires public domain
- ❌ Needs port 80 access
- ❌ Rate limits apply

```bash
./deployment/generate-ssl.sh --letsencrypt \
  --domain app.company.com \
  --email admin@company.com
```

**Auto-Renewal Setup:**

```bash
# Add to cron
sudo crontab -e

# Add this line (renew daily at 3 AM)
0 3 * * * certbot renew --deploy-hook '/path/to/gaderobe/deployment/generate-ssl.sh --letsencrypt --domain app.company.com --email admin@company.com' >> /var/log/certbot-renew.log 2>&1
```

### Custom Certificates

If you have your own certificates:

```bash
# Place files in ssl/ directory
cp /path/to/your/cert.pem ssl/cert.pem
cp /path/to/your/key.pem ssl/key.pem

# Generate PFX for backend
openssl pkcs12 -export -out ssl/cert.pfx \
  -inkey ssl/key.pem -in ssl/cert.pem -passout pass:

# Set permissions
chmod 600 ssl/key.pem ssl/cert.pfx
chmod 644 ssl/cert.pem

# Restart application
docker compose -f docker-compose.prod.yml restart
```

---

## Azure Entra ID Configuration

### Step 1: Register Application

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** (Entra ID)
3. Click **App registrations** → **New registration**

**Settings:**
- **Name**: Bekleidung App
- **Supported account types**: Accounts in this organizational directory only
- **Redirect URI**: Web → `https://your-server:3078/auth/callback`

Click **Register**.

### Step 2: Get Application IDs

From the **Overview** page, copy:
- **Application (client) ID** → `AZURE_CLIENT_ID`
- **Directory (tenant) ID** → `AZURE_TENANT_ID`

### Step 3: Create Client Secret

1. Go to **Certificates & secrets**
2. Click **New client secret**
3. **Description**: Bekleidung App Secret
4. **Expires**: 24 months (recommended)
5. Click **Add**
6. **Copy the secret VALUE** → `AZURE_CLIENT_SECRET`

⚠️ **IMPORTANT**: Copy the secret immediately. It won't be shown again!

### Step 4: Set API Permissions

1. Go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph** → **Delegated permissions**
4. Add these permissions:
   - `User.Read` (read user profile)
   - `email` (read user email)
   - `openid` (sign in)
   - `profile` (read user profile)
5. Click **Add permissions**
6. Click **Grant admin consent for [Your Organization]**

### Step 5: Update .env File

```bash
nano .env
```

Update with your Azure values:

```env
AZURE_TENANT_ID=12345678-1234-1234-1234-123456789abc
AZURE_CLIENT_ID=87654321-4321-4321-4321-cba987654321
AZURE_CLIENT_SECRET=your-secret-value-here
AZURE_REDIRECT_URI=https://your-server:3078/auth/callback
```

### Step 6: Restart Application

```bash
docker compose -f docker-compose.prod.yml restart
```

---

## First Login

### 1. Access Application

Open: `https://your-server:3078`

### 2. Click "Sign in with Microsoft"

You'll be redirected to Microsoft login page.

### 3. Login with Company Account

Use your Microsoft 365 / Entra ID account.

### 4. Set Admin Rights

First user needs to be promoted to admin manually:

```bash
docker compose -f docker-compose.prod.yml exec backend node scripts/set-admin.js user@company.com
```

Replace `user@company.com` with the email address that just logged in.

### 5. Verify Admin Access

- Logout and login again
- You should now see **Settings** button in the dashboard
- Access: Settings → Automatic Backup Config (admin-only section)

---

## Troubleshooting

### Issue: "Cannot connect to backend"

**Symptoms**: Frontend loads, but API calls fail.

**Solutions**:

```bash
# Check backend health
docker compose -f docker-compose.prod.yml logs backend

# Check if backend is running
docker compose -f docker-compose.prod.yml ps backend

# Restart backend
docker compose -f docker-compose.prod.yml restart backend
```

### Issue: "SSL certificate error"

**Self-signed certificates**:
1. Click "Advanced" in browser
2. Click "Proceed to site (unsafe)"
3. Accept security exception

**Let's Encrypt**:

```bash
# Verify certificate
openssl x509 -in ssl/cert.pem -text -noout

# Check expiration
openssl x509 -in ssl/cert.pem -noout -enddate

# Renew certificate
certbot renew
```

### Issue: "Azure login fails"

**Check redirect URI**:

```bash
# In .env file
AZURE_REDIRECT_URI=https://your-actual-domain:3078/auth/callback

# Must match exactly in Azure Portal:
# App registrations → Your App → Authentication → Redirect URIs
```

**Check permissions**:
- Verify admin consent granted in Azure Portal
- Ensure user has permission to sign in to the app

### Issue: "Email notifications not working"

**Test SMTP connection**:

```bash
docker compose -f docker-compose.prod.yml exec backend node -e "
const nodemailer = require('nodemailer');
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});
transport.verify().then(() => console.log('SMTP OK')).catch(console.error);
"
```

**Check logs**:

```bash
docker compose -f docker-compose.prod.yml logs backend | grep -i email
```

### Issue: "Database locked"

**Symptoms**: Errors mentioning "database is locked".

**Solution**:

```bash
# Stop application
docker compose -f docker-compose.prod.yml down

# Backup database
cp data/bekleidung.db data/bekleidung.db.backup

# Check for corruption
sqlite3 data/bekleidung.db "PRAGMA integrity_check;"

# Restart
docker compose -f docker-compose.prod.yml up -d
```

### Issue: "Port already in use"

**Change ports in .env**:

```env
FRONTEND_PORT=8443  # Change from 3078
BACKEND_PORT=8077   # Change from 3077
```

```bash
# Restart with new ports
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

### View All Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Backend only
docker compose -f docker-compose.prod.yml logs -f backend

# Frontend only
docker compose -f docker-compose.prod.yml logs -f frontend

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100
```

### Restart Services

```bash
# Restart everything
docker compose -f docker-compose.prod.yml restart

# Restart specific service
docker compose -f docker-compose.prod.yml restart backend
docker compose -f docker-compose.prod.yml restart frontend
```

### Complete Reset

⚠️ **WARNING**: This deletes all data!

```bash
# Stop and remove containers
docker compose -f docker-compose.prod.yml down -v

# Remove data (CAREFUL!)
rm -rf data/* uploads/* backups/* logs/*

# Rebuild and start fresh
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Next Steps

1. ✅ Configure automatic backups in Settings → Automatic Backup Config
2. ✅ Customize Dashboard quick-access buttons
3. ✅ Import existing employee data (if any)
4. ✅ Add clothing types and items
5. ✅ Set up regular update schedule with `./deployment/update.sh`

---

## Support

For issues and questions:

1. Check this documentation
2. Review application logs
3. Check GitHub Issues
4. Contact support team

---

**Installation complete!** 🎉
