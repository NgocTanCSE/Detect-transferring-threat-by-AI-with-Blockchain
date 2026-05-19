# Phase 1 Quick Reference Card

## 🚀 Service Startup

```bash
cd services/
docker-compose up -d          # Start all services
docker-compose ps             # Check status
docker-compose logs -f api-gateway  # View logs
curl http://localhost:8001/ready   # Health check
```

## 📍 Service Endpoints

| Service | Port | Type | Purpose |
|---------|------|------|---------|
| API Gateway | 8001 | Node.js | Central routing & auth |
| Auth | 3001 | Node.js | User authentication |
| Wallet | 3002 | Node.js | Wallet management |
| Alert | 3003 | Node.js | Alert system |
| Transfer | 3004 | Node.js | Protected transfers |
| Analytics | 3005 | Python | AI analysis |
| Compliance | 3006 | Node.js | AML & compliance |
| Event | 3007 | Node.js | WebSocket events |
| RabbitMQ | 5672 | Message Queue | Pub/Sub |
| RabbitMQ UI | 15672 | Web | Admin dashboard |
| PostgreSQL Main | 5432 | Database | Core tables |
| PostgreSQL Alerts | 5433 | Database | Alerts table |
| PostgreSQL Transfers | 5434 | Database | Transfers table |

## 📂 Key Files

```
services/
├── docker-compose.yml         # Infrastructure definition
├── .env.example              # Configuration template
├── README.md                 # Quick start guide
├── PHASE1_COMPLETION_SUMMARY.md  # This phase's summary
│
├── api-gateway/src/index.js  # Smart router implementation
│
├── shared/templates/
│   ├── NODEJS_TEMPLATE.md    # Node.js service pattern
│   └── PYTHON_TEMPLATE.md    # Python service pattern
```

## 🔧 Configuration

```bash
# Copy template
cp .env.example .env

# Edit with your values
ALCHEMY_API_KEY=your_key_here
ETHERSCAN_API_KEY=your_key_here
JWT_SECRET=your_secret_min_32_chars
```

## 🧪 Health Checks

```bash
# Gateway health
curl http://localhost:8001/health

# All services ready?
curl http://localhost:8001/ready

# Individual service
curl http://localhost:3001/health  # Auth Service
curl http://localhost:3003/health  # Alert Service
# ... etc
```

## 📨 Message Queue Topics

```
alerts.new_threat       # New threat alert published
transfers.completed     # Transfer completed
compliance.flagged      # Compliance violation
wallet.created          # New wallet created
transaction.confirmed   # Transaction confirmed
```

## 🐛 Debugging

```bash
# View service logs
docker-compose logs auth-service --tail=50

# View all logs
docker-compose logs --tail=100

# Restart single service
docker-compose restart auth-service

# Interactive shell
docker exec -it blockchain_auth_service sh

# Check service status
docker-compose ps
```

## 📊 RabbitMQ Management

```
URL: http://localhost:15672
Username: admin
Password: admin123
```

Visit to:
- View message queues
- Monitor connections
- Check consumer status
- View message rates

## 🔐 Database Access

```bash
# Connect to main database
psql postgresql://blockchain:blockchain123@localhost:5432/blockchain_main

# Alert database
psql postgresql://blockchain:blockchain123@localhost:5433/blockchain_alerts

# Transfer database
psql postgresql://blockchain:blockchain123@localhost:5434/blockchain_transfers
```

## 🛠️ Common Tasks

### Add a new service
1. Create directory: `mkdir services/my-service`
2. Copy template from `shared/templates/`
3. Update docker-compose.yml with new service
4. Add routes to API Gateway

### Deploy to staging
```bash
# Build with specific environment
docker-compose -f docker-compose.yml build
docker-compose -f docker-compose.yml up -d

# Push to registry
docker tag services-auth-service:latest myregistry.com/auth:v1
docker push myregistry.com/auth:v1
```

### Monitor in production
```bash
# Check service health
curl https://api.yourdomain.com/health

# View logs
docker-compose logs -f --tail=100

# Restart unhealthy service
docker-compose restart alert-service
```

## 📈 Next Phase: Phase 2 - Auth Service

**Start Date:** May 9-14, 2026
**Duration:** 2 weeks (Days 15-28)
**Focus:** Extract auth logic, implement JWT, integrate with gateway

**See:** `/docs/MICROSERVICES_MIGRATION_PLAN.md` for full details

## 🆘 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Services won't start | `docker-compose logs` to see errors |
| Port already in use | `lsof -i :PORT` to find process |
| Database connection fails | Check DATABASE_URL in .env |
| RabbitMQ not connecting | Verify RABBITMQ_URL and health |
| Health check 503 | Service dependencies not ready |

## 🎯 Phase 1 Deliverables

✅ 12 services fully orchestrated
✅ Smart API Gateway with auth & routing
✅ 8 microservices scaffolded
✅ RabbitMQ pub/sub configured
✅ 3 PostgreSQL databases set up
✅ Service templates (Node.js + Python)
✅ Complete documentation
✅ Environment configuration

---

**Status:** Phase 1 ✅ COMPLETE - Ready for Phase 2
