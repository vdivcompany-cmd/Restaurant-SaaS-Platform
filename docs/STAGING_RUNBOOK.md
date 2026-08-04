# Staging VPS Runbook & Deployment Guide

> ⚠️ **Superseded Document**  
> The project architecture migrated to Vercel Serverless and Upstash QStash in Phase 10. VPS, PM2, and Nginx deployment guides are retained for historical reference only. See `docs/phase-10-qstash-qr-session-pm2-removal.md` for current deployment infrastructure.

---

## 1. Prerequisites & Server Specifications

### Staging VPS Requirements
- **OS:** Ubuntu 24.04 LTS (64-bit)
- **CPU:** 2 vCPU
- **RAM:** 4 GB
- **Storage:** 40 GB NVMe / SSD
- **Network:** Public IPv4 address with DNS access

### Managed Cloud Infrastructure Services (Pre-configured)
- **MongoDB:** MongoDB Atlas Cluster (`MONGODB_URI`)
- **Redis:** Upstash Redis REST (`UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`)
- **RabbitMQ:** CloudAMQP Instance (`RABBITMQ_URL`)
- **Firebase:** Firebase Firestore Project (`FIREBASE_SERVICE_ACCOUNT_BASE64`)

---

## 2. Server Provisioning & Initial Setup

Log into the fresh Ubuntu staging VPS as `root`:

```bash
ssh root@YOUR_STAGING_IP
```

### Step 2.1 — System Updates, Base Dependencies, & Swap File
A swap file prevents the server from running out of memory during heavy npm/TypeScript compilation builds.
```bash
apt update && apt upgrade -y
apt install -y curl wget git unzip build-essential nginx certbot python3-certbot-nginx ufw

fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
```

### Step 2.2 — Create Dedicated Deployment User (Security Best Practice)
Never run web applications as root. Create a dedicated `deploy` user.
```bash
adduser deploy
usermod -aG sudo deploy
su - deploy
```
*(Perform all subsequent steps as the `deploy` user unless root/sudo is explicitly required)*

### Step 2.2 — Configure Firewall (UFW)
```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
```

### Step 2.3 — Install Node.js (via NodeSource / nvm)
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm install 20
nvm use 20
nvm alias default 20
node -v # Should display v20.x.x
```

### Step 2.4 — Install Global Process Managers & n8n
```bash
npm install -g pm2 n8n
pm2 install pm2-logrotate # Prevent log files from filling up the disk
```

---

## 3. Application Deployment Sequence

### Step 3.1 — Clone Repository & Setup Environment File
```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/vdivcompany-cmd/Restaurant-SaaS-Platform.git
cd Restaurant-SaaS-Platform/backend

# Create production environment configuration file
cp .env.production .env
# Edit .env to set actual production/staging secrets if necessary
nano .env
```

### Step 3.2 — Execute Deployment Script
```bash
chmod +x scripts/deploy.sh scripts/backup.sh scripts/restore-drill.sh
./scripts/deploy.sh
```

The script will automatically:
1. Fast-forward pull latest `main`
2. Install production node modules (`npm ci --omit=dev`)
3. Clean and compile TypeScript (`npm run build:prod`)
4. Start/reload PM2 processes (`pm2 reload ecosystem.config.js`)
5. Verify `/health` response on `http://127.0.0.1:3000/health`

### Step 3.3 — Setup PM2 Systemd Auto-restart
```bash
pm2 startup systemd
# Copy and execute the command printed by pm2 startup
pm2 save
```

---

## 4. Nginx Reverse Proxy & SSL Setup

### Step 4.1 — Symlink Site Configurations
```bash
cp /var/www/Restaurant-SaaS-Platform/nginx/sites-available/api.conf /etc/nginx/sites-available/api.conf
cp /var/www/Restaurant-SaaS-Platform/nginx/sites-available/n8n.conf /etc/nginx/sites-available/n8n.conf

# Replace staging-domain.com placeholders with actual staging domain names
sed -i 's/staging-domain.com/your-staging-domain.com/g' /etc/nginx/sites-available/api.conf
sed -i 's/staging-domain.com/your-staging-domain.com/g' /etc/nginx/sites-available/n8n.conf

# Enable vhosts
ln -sf /etc/nginx/sites-available/api.conf /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/n8n.conf /etc/nginx/sites-enabled/

# Test Nginx syntax
nginx -t
systemctl reload nginx
```

### Step 4.2 — Issue TLS Certificates via Certbot
```bash
certbot --nginx -d api.your-staging-domain.com
certbot --nginx -d n8n.your-staging-domain.com
```

Verify auto-renewal timer:
```bash
systemctl status certbot.timer
certbot dry-run
```

---

## 5. End-to-End Integration Verification Checklist

Perform the following verification steps against the live staging server:

| Verification Item | Command / Action | Expected Result | Pass? |
|---|---|---|---|
| **PM2 Process Layout** | `pm2 status` | All 8 processes (`api`, 6 workers, `n8n`) show status `online` | [ ] |
| **API Health Check** | `curl -sf https://api.your-staging-domain.com/health` | Returns `{"status":"ok", ...}` HTTP 200 | [ ] |
| **MongoDB Atlas** | Check API logs (`pm2 logs api`) | `MongoDB connected successfully` | [ ] |
| **Upstash Redis** | Run `npm run verify` in `backend/` | `Redis connected successfully` | [ ] |
| **CloudAMQP RabbitMQ** | Run `npm run verify` in `backend/` | `RabbitMQ channel connected successfully` | [ ] |
| **Firebase Firestore** | Check startup logs | `Firebase Admin SDK initialized successfully` | [ ] |
| **n8n Automation Engine** | Navigate to `https://n8n.your-staging-domain.com` | n8n dashboard loads securely over HTTPS | [ ] |
| **Idempotent Redeployment** | Run `./scripts/deploy.sh` second time | Clean zero-downtime build & reload without service disruption | [ ] |

---

## 6. Emergency Troubleshooting

- **Check Process Logs:** `pm2 logs` or `tail -f backend/logs/api.err.log`
- **Restart All PM2 Services:** `pm2 restart ecosystem.config.js`
- **Inspect Nginx Error Logs:** `tail -f /var/log/nginx/error.log`
- **Verify Port Binding:** `ss -tulpn | grep -E '3000|5678'`
