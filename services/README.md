# 🏗️ Blockchain AI - Microservices Architecture

Phase 1 Foundation for microservices migration from monolithic backend.

## 📋 Project Structure

```
services/
├── docker-compose.yml              # Orchestration for all 9 services + RabbitMQ + PostgreSQL
├── .env.example                    # Environment configuration template
├── package.json                    # Root workspace (optional)
│
├── api-gateway/                    # API Gateway (Port 8001)
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       └── index.js               # Smart routing, auth, rate limiting
│
├── auth-service/                   # Authentication Service (Port 3001)
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── routes/
│       ├── middleware/
│       └── services/
│
├── wallet-service/                 # Wallet Management (Port 3002)
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│
├── alert-service/                  # Alert Management (Port 3003)
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│
├── transfer-service/               # Transfer Processing (Port 3004)
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│
├── analytics-service/              # AI Analytics (Port 3005) [PYTHON]
│   ├── Dockerfile
│   ├── requirements.txt
│   └── src/
│
├── compliance-service/             # Compliance & AML (Port 3006)
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│
├── event-service/                  # WebSocket Events (Port 3007)
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│
└── shared/                         # Shared templates and configuration
    ├── templates/
    │   ├── NODEJS_TEMPLATE.md     # Node.js service templates
    │   └── PYTHON_TEMPLATE.md     # Python service templates
    └── config/
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- Python 3.11+ (for analytics service)

### 1. Environment Setup

```bash
cd services/
cp .env.example .env

# Edit .env with your configuration
# At minimum, set:
# - JWT_SECRET (32+ chars)
# - ALCHEMY_API_KEY
# - ETHERSCAN_API_KEY
```

### 2. Start All Services

```bash
# Build and start all containers
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### 3. Verify Services Are Running

```bash
# API Gateway health
curl http://localhost:8001/health

# All services ready
curl http://localhost:8001/ready

# RabbitMQ Management UI
# Open: http://localhost:15672 (admin / admin123)
```

## 📊 Service Overview

| Service | Port | Language | Purpose | Database |
|---------|------|----------|---------|----------|
| **API Gateway** | 8001 | Node.js | Routing, Auth, Rate Limiting | - |
| **Auth** | 3001 | Node.js | User authentication, JWT tokens | postgres_main |
| **Wallet** | 3002 | Node.js | Wallet management | postgres_main |
| **Alert** | 3003 | Node.js | Alert management & Pub/Sub | postgres_alerts |
| **Transfer** | 3004 | Node.js | Protected transfers | postgres_transfers |
| **Analytics** | 3005 | Python | AI analysis, risk scoring | postgres_main |
| **Compliance** | 3006 | Node.js | Compliance & AML checks | postgres_main |
| **Event** | 3007 | Node.js | WebSocket events | redis (cache) |

## 🔌 Infrastructure

### Message Queue
- **RabbitMQ** (localhost:5672)
- Topics: `alerts.new_threat`, `transfers.completed`, `compliance.flagged`
- Management UI: http://localhost:15672

### Databases
- **postgres_main** (5432) - Auth, Wallet, Compliance, Analytics
- **postgres_alerts** (5433) - Alerts
- **postgres_transfers** (5434) - Transfers

### Load Balancing
- API Gateway distributes requests based on route prefixes
- Services are independent and can be scaled horizontally

## 📝 API Routes

### Through API Gateway (localhost:8001)

```
POST   /auth/register          → Auth Service (3001)
POST   /auth/login             → Auth Service (3001)
GET    /wallets                → Wallet Service (3002)
GET    /alerts                 → Alert Service (3003)
POST   /transfers              → Transfer Service (3004)
GET    /statistics             → Analytics Service (3005)
GET    /compliance             → Compliance Service (3006)
WS     /events                 → Event Service (3007)
```

## 🧪 Development Workflow

### Local Setup (Without Docker)

For quick iteration, run services locally:

```bash
# Install dependencies for all services
cd services/auth-service && npm install
cd ../wallet-service && npm install
# ... etc

# Start each service in separate terminal
cd services/auth-service && npm run dev
cd services/wallet-service && npm run dev
# ... etc

# Services connect to Docker-based databases:
DATABASE_URL=postgresql://blockchain:blockchain123@localhost:5432/blockchain_main
```

### Running Tests

```bash
# Auth Service
cd services/auth-service && npm test

# Alert Service
cd services/alert-service && npm test

# etc...
```

## 📦 Docker Images

All services use lightweight base images:
- Node.js services: `node:18-alpine`
- Python service: `python:3.11-slim`
- RabbitMQ: `rabbitmq:3.12-management-alpine`
- PostgreSQL: `postgres:16-alpine`

Total image sizes: ~500MB for all services

## 🔒 Security Checklist

- [ ] Change default RabbitMQ credentials in production
- [ ] Set strong JWT_SECRET (minimum 32 characters)
- [ ] Enable HTTPS for all external communication
- [ ] Add rate limiting per IP
- [ ] Implement request validation (Joi/Pydantic)
- [ ] Add request logging and monitoring
- [ ] Use environment variables for all secrets
- [ ] Implement circuit breakers for inter-service communication

## 📈 Monitoring & Troubleshooting

### View Service Logs
```bash
docker-compose logs -f auth-service
docker-compose logs -f alert-service
# ... etc
```

### Check Service Dependencies
```bash
# Verify all services are healthy
curl http://localhost:8001/ready
```

### Restart a Service
```bash
docker-compose restart auth-service
```

### View RabbitMQ Queues
Open http://localhost:15672 and login with admin/admin123

## 📚 Next Steps (Phase 2: Auth Service Extraction)

After Phase 1 foundation is validated:

1. Extract auth logic from old monolithic backend
2. Implement JWT token management
3. Add API Gateway integration with Auth Service
4. Create unit & integration tests
5. Deploy to staging
6. Performance & load testing

See `MICROSERVICES_MIGRATION_PLAN.md` in docs/ for full details.

## 📝 Contributing

- Follow Node.js/Python code style in shared/templates/
- Add health checks to each service
- Include request validation
- Add comprehensive logging
- Write tests for new features

---

**Phase 1 Status:** ✅ **COMPLETE**
- ✅ Docker Compose with 9 services
- ✅ RabbitMQ message queue
- ✅ PostgreSQL multi-database setup
- ✅ API Gateway skeleton
- ✅ Service templates

**Ready for Phase 2:** Begin auth service extraction when scheduled.
