# Architecture Refactor: Monolithic → Microservices

**Date:** April 25, 2026
**Current State:** Monolithic Backend + Orchestrator
**Proposed State:** Full Microservices with proper API calls

---

## Current Architecture (Monolithic)

```
Frontend (3000)
    ↓
Backend-Node/Orchestrator (8001)
    ├─ Routes: /auth, /compliance, /alerts
    ├─ WebSocket: Socket.io
    └─ Proxy: /* → Backend (hard-coded forward)
         ↓
Backend/Monolithic (8000)
    ├─ /statistics/* (dashboard, flow)
    ├─ /wallets/* (analysis, connections)
    ├─ /alerts/* (all alert logic)
    ├─ /transfers/* (transfers + AI check)
    ├─ /blocked-transfers/* (blocked logic)
    ├─ /cases/* (case management)
    └─ /admin/* (admin functions)
         ↓
PostgreSQL
```

**Problems with current setup:**
- ❌ Backend is 2000+ lines in main.py (hard to maintain)
- ❌ Backend-Node just proxies (not adding value)
- ❌ Can't scale individual features
- ❌ One bug in any endpoint → whole backend down
- ❌ No clear API contracts between services

---

## Proposed Microservices Architecture

```
Frontend (3000)
    ├─ Call API Gateway (8001)
         ├─ Route /auth/* → Auth Service (3001)
         ├─ Route /wallets/* → Wallet Service (3002)
         ├─ Route /alerts/* → Alert Service (3003)
         ├─ Route /transfers/* → Transfer Service (3004)
         ├─ Route /analytics/* → Analytics Service (3005)
         ├─ Route /compliance/* → Compliance Service (3006)
         └─ WebSocket → Event Service (3007)

    ├─ WebSocket → Event Service (3007)
         ├ Emits: "new-threat", "transfer-blocked"
         └ Listens to all services via message queue

    └─ Direct calls (optional auth check)

Message Queue (RabbitMQ / Redis Pub/Sub)
├─ alerts.new_threat → Event Service broadcasts
├─ transfer.blocked → Event Service broadcasts
├─ wallet.risk_updated → Notifies subscribers
└─ compliance.violation → Notifies admins
```

---

## Service Breakdown

### 1. Auth Service (port 3001)
```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh-token
GET    /auth/profile
POST   /auth/logout
```
**Database:** User, Role, Token tables
**Dependencies:** None
**Calls:** None (independent)

---

### 2. Wallet Service (port 3002)
```
GET    /wallets              → List wallets with filters
GET    /wallets/{address}    → Wallet details
GET    /wallets/{address}/connections
GET    /wallets/{address}/history
POST   /wallets/{address}/update-status
```
**Database:** Wallets, TokenTransfers tables
**Dependencies:** None (independent analysis)
**Calls:**
- Call Alert Service: GET /alerts?wallet_address={address}
- Call Analytics Service: POST /analyze/wallet

---

### 3. Alert Service (port 3003)
```
GET    /alerts/latest
GET    /alerts/recent?chain={chain}
POST   /alerts/create
GET    /alerts/{id}
PUT    /alerts/{id}/acknowledge
```
**Database:** Alerts, AuditLog tables
**Dependencies:** None
**Calls:**
- Publish: alerts.new_threat → Message Queue (for Event Service)
- Call Wallet Service: GET /wallets/{address}

---

### 4. Transfer Service (port 3004)
```
POST   /transfers/protected
GET    /transfers/history
GET    /blocked-transfers?chain={chain}
POST   /transfers/{id}/approve
POST   /transfers/{id}/reject
```
**Database:** Transactions, BlockedTransfer tables
**Dependencies:** AI engines (Risk scoring)
**Calls:**
- Call Alert Service: POST /alerts/create (if blocked)
- Call Analytics Service: POST /analyze/transfer-risk
- Publish: transfer.blocked → Message Queue

---

### 5. Analytics Service (port 3005)
```
GET    /statistics/dashboard?chain={chain}
GET    /statistics/flow?chain={chain}
POST   /analyze/wallet
POST   /analyze/transfer-risk
GET    /models/registry
```
**Database:** RiskAssessment, ModelRegistry tables
**Dependencies:** AI engines (ML models, pattern detection)
**Calls:**
- Call Wallet Service: GET /wallets/{address}
- Call Alert Service: POST /alerts/create (if suspicious)

---

### 6. Compliance Service (port 3006)
```
GET    /compliance/policies
POST   /compliance/policies/create
GET    /compliance/audit
POST   /compliance/report
GET    /cases/list
PUT    /cases/{id}
```
**Database:** PolicyRule, AuditLog, TransactionCase tables
**Dependencies:** None
**Calls:**
- Call Alert Service: GET /alerts?severity=CRITICAL
- Call Transfer Service: GET /blocked-transfers
- Publish: compliance.violation → Message Queue

---

### 7. Event Service (port 3007)
```
WebSocket: /
  - Events: new-threat, transfer-blocked, wallet-updated, compliance-alert
  - Listeners: Message Queue subscribers
```
**Database:** None (stateless, message queue backed)
**Dependencies:** All services
**Calls:**
- Subscribe to all message queue topics
- Broadcast to connected WebSocket clients

---

### 8. API Gateway (port 8001)
```
Routing:
├─ /auth/* → Auth Service (3001)
├─ /wallets/* → Wallet Service (3002)
├─ /alerts/* → Alert Service (3003)
├─ /transfers/* → Transfer Service (3004)
├─ /analytics/* → Analytics Service (3005)
├─ /compliance/* → Compliance Service (3006)
└─ /events/* → Event Service (3007)

Features:
✓ Authentication/authorization (check JWT)
✓ Rate limiting per service
✓ Load balancing
✓ Circuit breaker (fallback if service down)
✓ Request logging
✓ Error handling
```

---

## Comparison: Current vs Proposed

| Aspect | Current | Proposed |
|--------|---------|----------|
| **Services** | 2 (Backend monolithic + Orchestrator) | 8 (7 services + Gateway) |
| **Ports** | 8000, 8001 | 3001-3007, 8001 |
| **Deployment** | 2 Docker containers | 9 Docker containers (1 gateway + 7 services + MQ) |
| **Scalability** | Limited (scale whole backend) | Per-service (scale Alert Service 3x if needed) |
| **Fault Isolation** | Alert bug → whole backend down ❌ | Alert bug → only Alert Service down ✅ |
| **Team Size** | 1 team (one monolith) | 2-3 teams (each owns services) |
| **API Contracts** | Implicit (main.py) | Explicit (OpenAPI/Swagger per service) |
| **Testing** | Integration tests only | Unit + Integration per service |
| **CI/CD** | Deploy whole backend | Deploy individual services |

---

## Migration Strategy

### Phase 1: Extract Auth Service (1-2 weeks)
**Steps:**
1. Create Auth Service (Node.js/Python)
2. Copy auth logic from Backend → Auth Service
3. Update Backend to call Auth Service for token validation
4. Update Backend-Node to route /auth/* → Auth Service
5. Test all auth flows
6. Keep backward compatibility (old routes still work)

**Effort:** 40 hours
**Risk:** Low (can rollback easily)

---

### Phase 2: Extract Alert Service (2-3 weeks)
**Steps:**
1. Create Alert Service
2. Copy alert logic, models, database migration
3. Create Message Queue (RabbitMQ/Redis)
4. Update Backend to call Alert Service (via HTTP)
5. Update Event broadcasting (publish to MQ)
6. Migrate alert database tables to Alert Service DB
7. Update Frontend to subscribe to Message Queue alerts

**Effort:** 60 hours
**Risk:** Medium (complex data migration)

---

### Phase 3: Extract Analytics/Transfer Services (3-4 weeks)
**Steps:**
1. Create Analytics Service (AI engines)
2. Create Transfer Service
3. Move AI models to Analytics Service
4. Implement service-to-service calls with Circuit Breaker
5. Update Transfer Service to call Analytics for risk scoring
6. Implement distributed tracing (for debugging)

**Effort:** 80 hours
**Risk:** High (business critical services)

---

### Phase 4: Extract Wallet/Compliance Services (2-3 weeks)
**Steps:**
1. Create Wallet Service
2. Create Compliance Service
3. Implement caching (Redis) for performance
4. Add service-to-service authentication (mTLS or API keys)
5. Implement centralized logging (ELK/Loki)

**Effort:** 50 hours
**Risk:** Medium

---

### Phase 5: Implement API Gateway Fully (1-2 weeks)
**Steps:**
1. Replace Backend-Node proxy with proper API Gateway
2. Add authentication/authorization to gateway
3. Add rate limiting per service
4. Add circuit breaker (fallback if service down)
5. Add request logging/tracing
6. Update Frontend to use gateway only

**Effort:** 40 hours
**Risk:** Low

---

### Phase 6: Decommission Monolithic Backend (1 week)
**Steps:**
1. All functionality moved to microservices
2. Remove old Backend service
3. Archive old database
4. Clean up old code

**Effort:** 20 hours
**Risk:** Low (all services tested)

---

## Total Effort Estimate

| Phase | Effort | Risk |
|-------|--------|------|
| 1. Auth Service | 40h | Low |
| 2. Alert Service | 60h | Medium |
| 3. Analytics/Transfer | 80h | High |
| 4. Wallet/Compliance | 50h | Medium |
| 5. API Gateway | 40h | Low |
| 6. Decommission | 20h | Low |
| **Total** | **290 hours** | - |

**Timeline:** ~2-3 months (with 1 developer, full-time)
**With 2 developers:** ~4-6 weeks (can parallelize phases 1-2)

---

## Infrastructure Changes

### Current Stack
```yaml
version: '3.8'
services:
  backend:
    image: python:3.11
    ports: [8000]

  backend-node:
    image: node:18
    ports: [8001]

  frontend:
    ports: [3000]

  db:
    image: postgres:16
```

### Proposed Stack
```yaml
version: '3.8'
services:
  api-gateway:
    image: node:18
    ports: [8001]
    depends_on: [auth-service, alert-service, ...]

  auth-service:
    image: python:3.11 / node:18
    ports: [3001]
    environment:
      DATABASE_URL: postgres://auth_db

  alert-service:
    image: python:3.11
    ports: [3003]
    environment:
      DATABASE_URL: postgres://alert_db

  # ... (6 more services)

  message-queue:
    image: rabbitmq:3.11
    ports: [5672, 15672]

  db:
    image: postgres:16 (or multiple instances)

  # Optional: centralized logging
  loki:
    image: grafana/loki

  # Optional: distributed tracing
  jaeger:
    image: jaegertracing/all-in-one
```

---

## Database Strategy

### Option 1: Shared Database (Simpler)
```
All services share same PostgreSQL instance
Pros:
  ✅ Easy transactions across services
  ✅ Simpler migrations
  ✅ Lower infrastructure cost
Cons:
  ❌ Database becomes single point of failure
  ❌ Services tightly coupled via DB schema
  ❌ Hard to scale database per service
```

### Option 2: Database per Service (Recommended)
```
Each service has own database
Services communicate via REST/Message Queue

Auth Service     → PostgreSQL auth_db
Alert Service    → PostgreSQL alert_db
Transfer Service → PostgreSQL transfer_db
Analytics Service → PostgreSQL analytics_db + MongoDB (models)
Compliance Service → PostgreSQL compliance_db

Pros:
  ✅ True microservices (independent)
  ✅ Can scale DB per service
  ✅ Technology choice per service
  ✅ Better for team autonomy
Cons:
  ❌ Distributed transactions (complex)
  ❌ Data consistency challenges
  ❌ Higher infrastructure cost
```

**Recommendation:** Start with shared DB, migrate to DB-per-service as you scale.

---

## Communication Patterns

### Synchronous (HTTP REST)
```
Frontend → API Gateway → Auth Service → Response
Transfer Service → Analytics Service (sync) → Risk score
```
**Use when:** Need immediate response
**Latency:** ~10-50ms

### Asynchronous (Message Queue)
```
Alert Service → RabbitMQ (new-threat) → Event Service → WebSocket → Frontend
```
**Use when:** Can wait, want decoupling
**Latency:** ~100-500ms

---

## API Examples (Microservices)

### Auth Service
```bash
POST http://localhost:3001/auth/login
Body: { username, password }
Response: { token, refresh_token }
```

### Alert Service
```bash
GET http://localhost:3003/alerts/recent?chain=ethereum&limit=10
Response: [{ id, wallet_address, severity, chain_id, message, ... }]

POST http://localhost:3003/alerts/create
Body: { wallet_address, severity, message, chain_id }
Response: { id, created_at }
```

### Analytics Service
```bash
POST http://localhost:3005/analyze/wallet
Body: { wallet_address, chain }
Response: { risk_score, risk_level, patterns: [...] }

GET http://localhost:3005/statistics/dashboard?chain=ethereum
Response: { wallet_count, alert_count, ... }
```

### Transfer Service
```bash
POST http://localhost:3004/transfers/protected
Body: { from, to, amount, chain, confirm_risk }
Response: { status: approved|blocked, reason, transfer_id }
```

### API Gateway (single entry point)
```bash
GET http://localhost:8001/alerts/recent?chain=ethereum
  → routes to → Alert Service (3003)

POST http://localhost:8001/auth/login
  → routes to → Auth Service (3001)

GET http://localhost:8001/analytics/dashboard?chain=ethereum
  → routes to → Analytics Service (3005)
```

---

## Monitoring & Observability

### Centralized Logging
```
All services → Loki/ELK
├─ [2026-04-25 10:30:22] auth-service: User login successful (user_id=123)
├─ [2026-04-25 10:30:23] alert-service: New threat detected (severity=CRITICAL)
└─ [2026-04-25 10:30:24] transfer-service: Transfer approved (transfer_id=456)
```

### Distributed Tracing
```
Frontend request → API Gateway (trace_id=abc123)
  └─ Auth Service (spans)
  └─ Transfer Service (spans)
    └─ Analytics Service (spans)
  └─ Alert Service (spans)
Total latency: 245ms
```

### Service Health
```
GET http://localhost:8001/health
Response: {
  "gateway": "healthy",
  "auth-service": "healthy",
  "alert-service": "degraded (slow)",
  "transfer-service": "unhealthy (down)",
  ...
}
```

---

## Recommendations

### ✅ Go with Microservices IF:
- Team size: 3+ developers
- Project complexity: High (multiple domains)
- Scale requirements: Different services need different scale
- Timeline: 2-3+ months available
- DevOps capability: Can manage multiple services

### ❌ Stick with Monolithic IF:
- Team size: 1-2 developers
- Project is stable (not changing much)
- Timeline: Need to deliver in 2-4 weeks
- DevOps: Limited resources

---

## Hybrid Approach (Recommended)

**Short-term (now - 1 month):** Keep current Monolithic + Orchestrator
- Works, no changes needed
- Focus on features

**Medium-term (1-2 months):** Extract high-value services incrementally
- Auth Service (low risk)
- Alert Service (high value for real-time)
- Analytics Service (isolate complex AI logic)

**Long-term (2-3 months):** Full microservices
- All services independent
- API Gateway as single entry point
- Message Queue for async events

---

## Next Steps

1. **Decision:** Commit to microservices migration or stay monolithic?
2. **If yes:** Start with Phase 1 (Auth Service extraction)
3. **If no:** Continue current architecture (works fine for now)

**Current recommendation:** Given current team size (appears to be 1), **stay with monolithic** for now. Refactor to microservices when:
- Team grows to 3+
- Service load becomes bottleneck
- Different teams own different features

But the **plan above** is documented for future reference when ready to scale.
