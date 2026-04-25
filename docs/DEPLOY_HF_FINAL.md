# Deployment to Hugging Face Spaces

## Overview

This document guides the deployment of the multi-chain blockchain AI project to Hugging Face (HF) Spaces with persistent PostgreSQL storage.

**Deployment Environment:**
- Platform: Hugging Face Spaces
- Runtime: Docker
- Database: PostgreSQL (persistent volume or managed service)
- Frontend: Next.js 14 (static export or Server)
- Backend: FastAPI with multi-chain support

---

## Prerequisites

- [ ] HF Spaces account with Docker runtime capability
- [ ] Hugging Face Space created (name: `blockchain-ai-project` or similar)
- [ ] GitHub repository with code pushed
- [ ] PostgreSQL database provisioned (HF Spaces or external)
- [ ] All smoke tests passing locally ✅
- [ ] Docker images built and tested locally

---

## Step 1: Prepare Deployment Configuration

### 1.1 Create `.hf/hf_config.json`

```json
{
  "space_name": "blockchain-ai-project",
  "runtime": "docker",
  "persistence": {
    "enabled": true,
    "paths": ["/data/postgres", "/app/logs"]
  },
  "environment_variables": {
    "DATABASE_URL": "postgresql://user:password@postgres-host:5432/blockchain_ai",
    "FASTAPI_ENV": "production",
    "NEXT_PUBLIC_API_URL": "https://your-space.hf.space:8000",
    "NEXT_PUBLIC_SOCKET_URL": "https://your-space.hf.space:8001",
    "JWT_SECRET": "{{HF_SECRET_JWT_KEY}}",
    "ALCHEMY_API_KEY": "{{HF_SECRET_ALCHEMY_KEY}}"
  }
}
```

### 1.2 Update `docker-compose.yml` for HF

```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: blockchain_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: blockchain_ai
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U blockchain_user"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - blockchain_network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://blockchain_user:${DB_PASSWORD}@db:5432/blockchain_ai
      FASTAPI_ENV: production
      JWT_SECRET: ${JWT_SECRET}
      ALCHEMY_API_KEY: ${ALCHEMY_API_KEY}
    ports:
      - "8000:8000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - blockchain_network

  backend-node:
    build:
      context: ./backend-node
      dockerfile: Dockerfile
    depends_on:
      - backend
    environment:
      AI_SERVICE_URL: http://backend:8000
      FRONTEND_URL: ${NEXT_PUBLIC_API_URL}
    ports:
      - "8001:8001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - blockchain_network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
        NEXT_PUBLIC_SOCKET_URL: ${NEXT_PUBLIC_SOCKET_URL}
    depends_on:
      - backend-node
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
      NEXT_PUBLIC_SOCKET_URL: ${NEXT_PUBLIC_SOCKET_URL}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - blockchain_network

  scanner:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: scanner
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://blockchain_user:${DB_PASSWORD}@db:5432/blockchain_ai
      ALCHEMY_API_KEY: ${ALCHEMY_API_KEY}
    networks:
      - blockchain_network

volumes:
  postgres_data:

networks:
  blockchain_network:
    driver: bridge
```

### 1.3 Create `.env.hf` (for local testing)

```bash
# HF Spaces Environment
DATABASE_URL=postgresql://blockchain_user:your_secure_password@db:5432/blockchain_ai
FASTAPI_ENV=production
NEXT_PUBLIC_API_URL=https://your-username-blockchain-ai-project.hf.space
NEXT_PUBLIC_SOCKET_URL=https://your-username-blockchain-ai-project.hf.space
JWT_SECRET=your_jwt_secret_key_here
ALCHEMY_API_KEY=your_alchemy_api_key_here
DB_PASSWORD=your_secure_password
```

---

## Step 2: Prepare Dockerfile for HF Spaces

### 2.1 Create `Dockerfile.hf` (root level)

```dockerfile
FROM ubuntu:22.04

# Install Docker
RUN apt-get update && apt-get install -y docker.io docker-compose

# Copy project
WORKDIR /app
COPY . .

# Expose ports
EXPOSE 3000 8000 8001

# Start all services
CMD ["docker-compose", "up", "-d", "&&", "tail", "-f", "/dev/null"]
```

**Alternative: Use official HF Dockerfile template**

```dockerfile
# Start from HF base image
FROM huggingface/docker-hf-base:latest

# Install dependencies
RUN apt-get update && apt-get install -y \
    python3-pip \
    nodejs \
    npm \
    postgresql \
    postgresql-contrib

# Copy project
WORKDIR /app
COPY . .

# Install Python requirements
RUN pip install -r backend/requirements.txt

# Install Node dependencies
WORKDIR /app/frontend
RUN npm ci
RUN npm run build

# Return to app root
WORKDIR /app

# Expose ports
EXPOSE 3000 8000 8001

# Start services using supervisor
CMD ["supervisord", "-c", "supervisord.conf"]
```

---

## Step 3: Prepare for HF Spaces Deployment

### 3.1 Create `README.md` for HF Space

```markdown
# Blockchain AI Security Platform - Multi-Chain

Real-time AI-powered threat detection for blockchain transactions across Ethereum and BSC.

## Features

✅ Multi-chain support (Ethereum + BSC)
✅ Real-time WebSocket alerts
✅ Risk scoring with ML models
✅ Case management dashboard
✅ Role-based access control

## Components

- **Frontend**: Next.js 14 (React + TypeScript)
- **Backend**: FastAPI (Python)
- **Node Orchestrator**: Express + Socket.io
- **Database**: PostgreSQL 16
- **Blockchain**: Alchemy API (Ethereum + BSC)

## Chain Support

| Chain | Native Asset | Aliases | Status |
|-------|---|---|---|
| Ethereum | ETH | eth, 1 | ✅ Production |
| BSC | BNB | bsc, bnb, binance, 56 | ✅ Production |

## Getting Started

1. View the [deployment guide](#deployment)
2. Set environment variables in Spaces secrets
3. Run Docker Compose
4. Access at `https://your-space.hf.space`

## Demo Credentials

- Username: `alice@lab.ai`
- Password: `password123`
- Role: Admin

## Monitoring

- Backend health: `/health`
- Dashboard: `/user/dashboard`
- Case management: `/user/cases`
- Exchange (transfers): `/user/exchange`

## Documentation

- [Architecture](./docs/CHAIN_ASSET_MATRIX.md)
- [API Contract](./EXCHANGE_API_CONTRACT.md)
- [Smoke Tests](./SMOKE_TESTS.md)
- [Rollback Procedure](./ROLLBACK.md)

## Support

For issues, see:
- [Implementation Status](./AUDIT_IMPLEMENTATION_STATUS.md)
- [Troubleshooting](./docs/TROUBLESHOOTING.md)
```

### 3.2 Create `Dockerfile` in root for HF

```dockerfile
# Multi-stage Dockerfile for HF Spaces
FROM python:3.11-slim as backend

WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM node:18-alpine as frontend

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend .
RUN npm run build

FROM postgres:16-alpine

WORKDIR /app

# Install Docker & Compose
RUN apk add --no-cache docker-cli docker-cli-compose curl

# Copy entire project
COPY . .
COPY --from=backend /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=frontend /app/frontend/.next /app/frontend/.next

# Expose all service ports
EXPOSE 3000 8000 8001 5432

# Start services
CMD ["docker-compose", "up"]
```

---

## Step 4: Set Up HF Spaces Secrets

In HF Spaces settings, add these secrets:

```
HF_SECRET_JWT_KEY = your_jwt_secret_here
HF_SECRET_ALCHEMY_KEY = your_alchemy_api_key_here
DATABASE_PASSWORD = your_secure_db_password
DATABASE_USER = blockchain_user
DATABASE_HOST = db (if using compose) or external host
FASTAPI_ENV = production
FRONTEND_URL = https://your-space.hf.space
```

---

## Step 5: Deploy to HF Spaces

### Option A: Push to HF Hub (Automatic Deployment)

```bash
# 1. Login to HF
huggingface-cli login

# 2. Clone your HF Space
git clone https://huggingface.co/spaces/your-username/blockchain-ai-project
cd blockchain-ai-project

# 3. Add project files
cp -r /path/to/blockchain-ai-project/* .

# 4. Update .gitignore
echo "node_modules/" >> .gitignore
echo "backend/venv/" >> .gitignore
echo "__pycache__/" >> .gitignore
echo ".env*" >> .gitignore

# 5. Push to HF
git add .
git commit -m "Deploy multi-chain blockchain AI to HF Spaces"
git push

# HF will automatically build and deploy from Dockerfile
```

### Option B: Manual Docker Build on HF

1. Go to HF Spaces settings
2. Select "Docker" runtime
3. HF will use `Dockerfile` from root directory
4. Add secrets to "Manage Secrets"
5. Click "Build from Docker"
6. Wait for deployment (~10-15 minutes)

---

## Step 6: Verification After Deployment

### 6.1 Test Backend Endpoints

```bash
SPACE_URL="https://your-username-blockchain-ai-project.hf.space"

# Health check
curl $SPACE_URL:8000/

# Dashboard (ethereum)
curl $SPACE_URL:8000/statistics/dashboard

# Dashboard (bsc)
curl $SPACE_URL:8000/statistics/dashboard?chain=bsc

# Alerts
curl "$SPACE_URL:8000/alerts/recent?chain=ethereum&limit=5"
```

### 6.2 Test Frontend

1. Open `https://your-space.hf.space`
2. Login with demo credentials
3. Navigate to `/user/exchange`
4. Verify chain selector dropdown
5. Try switching between Ethereum and BSC
6. Check that asset changes (ETH ↔ BNB)

### 6.3 Check WebSocket

1. Open Browser DevTools (F12)
2. Go to Console
3. Should see: "Connected to Real-time Sentinel Node"
4. Check Network tab for `socket.io` connection

### 6.4 Monitor Logs

```bash
# Backend logs
docker logs blockchain_backend

# Database logs
docker logs blockchain_db

# Frontend logs
docker logs blockchain_frontend
```

---

## Step 7: Production Checklist

- [ ] All environment variables set in HF Secrets
- [ ] PostgreSQL backup enabled
- [ ] JWT_SECRET uses strong random key
- [ ] ALCHEMY_API_KEY is valid and funded
- [ ] SSL/TLS enabled (automatic on HF)
- [ ] CORS configured for HF domain
- [ ] Rate limiting enabled on endpoints
- [ ] Logging configured (check `/logs` volume)
- [ ] Monitoring alerts set up
- [ ] Rollback plan documented (see ROLLBACK.md)

---

## Step 8: Post-Deployment Monitoring

### 8.1 Set Up Health Checks

Add to HF Spaces configuration:

```yaml
health_check:
  enabled: true
  path: /health
  interval: 300  # seconds
  timeout: 30
```

### 8.2 Monitor Database Growth

```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('blockchain_ai'));

-- Check wallet count
SELECT chain_id, COUNT(*) FROM wallets GROUP BY chain_id;

-- Check alert count
SELECT chain_id, COUNT(*) FROM alerts GROUP BY chain_id;
```

### 8.3 Monitor WebSocket Connections

Check Node logs for connection statistics:

```bash
docker logs blockchain_node | grep -i "client connected\|client disconnected"
```

---

## Troubleshooting

### Issue: Database Connection Fails

**Solution:**
```bash
# Check DATABASE_URL is correct
docker exec blockchain_db psql -U blockchain_user -d blockchain_ai -c "SELECT 1"

# Check migrations ran
docker logs blockchain_backend | grep "schema fix"
```

### Issue: Frontend Can't Reach Backend

**Solution:**
1. Check NEXT_PUBLIC_API_URL is set correctly in environment
2. Verify backend is running: `curl http://localhost:8000/`
3. Check CORS configuration in Node/FastAPI
4. Verify firewall allows internal service communication

### Issue: WebSocket Connection Refused

**Solution:**
```bash
# Check Node orchestrator is running
curl http://localhost:8001/health

# Check Socket.io port is exposed
docker ps | grep backend-node
```

### Issue: Slow Response Times

**Solution:**
1. Check database indexes: `SELECT * FROM pg_stat_user_indexes`
2. Check query performance: `EXPLAIN ANALYZE SELECT ...`
3. Verify no long-running transactions
4. Scale Kubernetes pods if needed (HF managed)

---

## Rollback to Previous Version

See [ROLLBACK.md](ROLLBACK.md) for detailed procedure.

Quick rollback:
```bash
# Revert to previous commit
git revert HEAD
git push

# HF will automatically rebuild from previous Dockerfile
```

---

## Documentation Updates

After deployment, update:
- [ ] [README.md](./README.md) - Add HF Spaces link
- [ ] [DEPLOYMENT.md](./DEPLOY_HF_SUPABASE.md) - Update with actual HF URL
- [ ] [API_ENDPOINTS_BY_TABLE.md](./API_ENDPOINTS_BY_TABLE.md) - Update base URL

---

## Support & Escalation

| Issue | Contact | Response Time |
|-------|---------|---|
| Service down | HF Support | 1 hour |
| Database issue | HF DB team | 2 hours |
| API bug | Development team | 4 hours |
| Feature request | Product team | 1 week |

---

## Next Steps

1. ✅ Deploy to HF Spaces
2. ✅ Verify all endpoints working
3. ✅ Collect feedback from users
4. ⏳ Plan Phase 4 (Reporting + Analytics)
5. ⏳ Implement advanced features (custom rules, webhooks)

