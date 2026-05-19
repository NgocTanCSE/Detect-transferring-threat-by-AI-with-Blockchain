## 🔌 API Endpoints by Data Type

Mỗi endpoint dưới đây **READ/WRITE** từ database `/data/blockchain_local.db`.

---

## 📋 TABLE: Users

**Seed Data:** 5,003 users (5000 demo + 3 test)

| Method | Endpoint | Tables | Response |
|--------|----------|--------|----------|
| `POST` | `/api/auth/register` | users, wallets | `{id, username, email, role}` |
| `POST` | `/api/auth/login` | users | JWT token |
| `GET` | `/api/auth/me` | users | `{id, username, email, role, wallet_address}` |
| `PUT` | `/api/auth/profile` | users | Updated user |
| `POST` | `/api/auth/change-password` | users | `{status: "ok"}` |

**Test Account:**
```
POST /api/auth/login
{
  "username": "admin",
  "password": "admin123"
}
```

---

## 💰 TABLE: Wallets

**Seed Data:** 5,003 wallets (risk score 5-95)

| Method | Endpoint | Query/Response |
|--------|----------|--------|
| `GET` | `/api/wallet/[address]/details` | Wallet info, TX count, risk score |
| `GET` | `/api/wallet/[address]/transactions` | List of TXs from/to wallet |
| `GET` | `/api/wallet/[address]/alerts` | Recent alerts for wallet |
| `GET` | `/api/wallet/[address]/risk-history` | Historical risk assessments |
| `PUT` | `/api/wallet/[address]/flag` | Flag/unflag wallet |
| `PUT` | `/api/wallet/[address]/notes` | Update admin notes |

**Example Request:**
```bash
GET /api/wallet/0x742d35Cc6634C0532925a3b844Bc9e7595f/details
Response:
{
  "address": "0x742d...",
  "label": "Demo Wallet 1",
  "entity_type": "User",
  "account_status": "active",
  "risk_score": 42.5,
  "risk_category": "manipulation",
  "total_transactions": 5,
  "total_value_sent": "2.5",
  "total_value_received": "10.0",
  "first_seen_at": "2024-10-20T...",
  "last_activity_at": "2024-12-15T..."
}
```

---

## 📊 TABLE: Transactions

**Seed Data:** ~25,000 transactions (5 per user)

| Method | Endpoint | Query/Response |
|--------|----------|--------|
| `GET` | `/api/transactions` | List all TXs (paginated) |
| `GET` | `/api/transactions/[txHash]` | TX details + case info |
| `GET` | `/api/transfers/flow-stats` | High-risk inflow/outflow |
| `GET` | `/api/transfers/blocked` | Recently blocked attempts |
| `GET` | `/api/transfers/by-risk` | TXs grouped by risk level |

**Example Request:**
```bash
GET /api/transfers/flow-stats?days=7
Response:
{
  "high_risk_inflow_eth": "52.3",
  "high_risk_outflow_eth": "38.1",
  "inflow_count": 145,
  "outflow_count": 98,
  "average_inflow_value": "0.361",
  "average_outflow_value": "0.389"
}

GET /api/transfers/blocked?limit=20
Response:
[
  {
    "sender_address": "0x...",
    "receiver_address": "0x...",
    "amount": "1.5",
    "risk_score": 85.2,
    "block_reason": "High risk threshold exceeded",
    "blocked_at": "2024-12-15T10:30:00Z"
  }
]
```

---

## 🚨 TABLE: Alerts

**Seed Data:** ~500 alerts (severity CRITICAL/HIGH)

| Method | Endpoint | Response |
|--------|----------|----------|
| `GET` | `/api/ops/security/alerts-summary` | Alert counts by severity |
| `GET` | `/api/alerts` | List all alerts (paginated) |
| `GET` | `/api/alerts/[walletAddress]` | Alerts for specific wallet |
| `POST` | `/api/alerts/[id]/acknowledge` | Mark as acknowledged |
| `DELETE` | `/api/alerts/[id]` | Delete alert |

**Example Response:**
```json
{
  "total": 487,
  "critical": 98,
  "high": 389,
  "by_alert_type": {
    "Risk Spike": 400,
    "Unusual Activity": 87
  },
  "recent_alerts": [
    {
      "id": "uuid",
      "wallet_address": "0x...",
      "alert_type": "Risk Spike",
      "severity": "CRITICAL",
      "message": "Wallet exceeded risk threshold",
      "risk_score": 87.5,
      "detected_at": "2024-12-15T10:30:00Z",
      "acknowledged": false
    }
  ]
}
```

---

## 🚫 TABLE: BlockedTransfers

**Seed Data:** ~300 blocked attempts

| Method | Endpoint | Response |
|--------|----------|----------|
| `GET` | `/api/transfers/blocked` | List blocked TXs |
| `GET` | `/api/transfers/blocked/stats` | Blocked count & reasons |
| `POST` | `/api/transfers/block` | Manually block transfer |

**Example Response:**
```json
{
  "total_blocked": 298,
  "total_eth_blocked": "223.5",
  "blocks_by_reason": {
    "High risk threshold exceeded": 298
  },
  "blocks_by_date": {
    "2024-12-15": 12,
    "2024-12-14": 15
  },
  "recent": [
    {
      "sender_address": "0x...",
      "receiver_address": "0x...",
      "amount": "2.5",
      "block_reason": "High risk threshold exceeded",
      "risk_score": 82.1,
      "blocked_at": "2024-12-15T10:30:00Z"
    }
  ]
}
```

---

## 📋 TABLE: TransactionCases

**Seed Data:** ~400 cases (mixed states: PENDING/VERIFIED/FRAUD/IGNORED)

| Method | Endpoint | Response |
|--------|----------|----------|
| `GET` | `/api/ops/security/case-summary` | Case counts by state |
| `GET` | `/api/cases/[txHash]` | Case details for TX |
| `POST` | `/api/cases/[txHash]/assign` | Assign to analyst |
| `PUT` | `/api/cases/[txHash]/update` | Change state/action |
| `POST` | `/api/cases/[txHash]/comment` | Add analyst notes |

**Example Response:**
```json
{
  "tx_hash": "0x...",
  "analyst_id": "user-uuid",
  "analyst_name": "demo_user_00042",
  "action": "ASSIGN",
  "state": "PENDING",
  "notes": "Suspicious pattern detected",
  "case_created_at": "2024-12-10T...",
  "last_updated": "2024-12-15T..."
}
```

---

## 🛡️ TABLE: PolicyRules

**Seed Data:** 3 policy rules

| Method | Endpoint | Response |
|--------|----------|----------|
| `GET` | `/api/ops/compliance/policy-rules` | All active rules |
| `GET` | `/api/ops/compliance/policy-rules/[id]` | Specific rule |
| `POST` | `/api/ops/compliance/policy-rules` | Create rule |
| `PUT` | `/api/ops/compliance/policy-rules/[id]` | Update rule |
| `DELETE` | `/api/ops/compliance/policy-rules/[id]` | Delete rule |

**Example Response:**
```json
[
  {
    "id": "rule-uuid",
    "rule_name": "Block High Risk Transfers",
    "description": "Block transfers above risk threshold",
    "min_risk_score": 80.0,
    "block_blacklisted": true,
    "block_suspended": true,
    "notify_on_block": true,
    "priority": 10,
    "is_active": true,
    "created_by": "admin"
  }
]
```

---

## 📲 TABLE: NotificationEvents

**Seed Data:** ~60 notification events

| Method | Endpoint | Response |
|--------|----------|----------|
| `GET` | `/api/notifications` | List all notifications |
| `GET` | `/api/notifications/stats` | By channel/status |
| `POST` | `/api/notifications/resend` | Retry failed |
| `DELETE` | `/api/notifications/[id]` | Delete notification |

**Example Response:**
```json
{
  "total": 59,
  "by_channel": {
    "slack": 15,
    "email": 15,
    "webhook": 15,
    "telegram": 14
  },
  "by_status": {
    "sent": 39,
    "queued": 15,
    "failed": 5
  },
  "by_severity": {
    "CRITICAL": 12,
    "HIGH": 20,
    "MEDIUM": 15,
    "LOW": 12
  }
}
```

---

## 🤖 TABLE: ModelRegistry

**Seed Data:** 3 ML models (1 active)

| Method | Endpoint | Response |
|--------|----------|----------|
| `GET` | `/api/ops/ai/active-models` | Currently deployed models |
| `GET` | `/api/ops/ai/model-registry` | All models + versions |
| `POST` | `/api/ops/ai/models/promote` | Promote model to active |
| `POST` | `/api/ops/ai/models/register` | Register new model |

**Example Response:**
```json
{
  "active_models": [
    {
      "id": "model-uuid",
      "model_name": "risk_detector",
      "version": "v1.4.0",
      "framework": "pkl",
      "artifact_uri": "s3://...",
      "promoted_at": "2024-12-13T...",
      "promoted_by": "admin"
    }
  ],
  "inactive_models": [
    {
      "model_name": "transaction_graph_model",
      "version": "v2.1.0",
      "framework": "onnx"
    }
  ]
}
```

---

## 🔧 TABLE: FeatureStoreConfig

**Seed Data:** 12 feature toggles

| Method | Endpoint | Response |
|--------|----------|----------|
| `GET` | `/api/ops/ai/feature-store` | All features |
| `GET` | `/api/ops/ai/feature-store/enabled` | Active features only |
| `POST` | `/api/ops/ai/feature-store/[key]/toggle` | Enable/disable feature |

**Example Response:**
```json
{
  "total_features": 12,
  "enabled": 9,
  "disabled": 3,
  "features": [
    {
      "feature_key": "feature_00",
      "enabled": true,
      "expression": "risk_score >= 40",
      "owner": "admin",
      "created_at": "2024-10-26T...",
      "updated_at": "2024-12-15T..."
    }
  ]
}
```

---

## 🖥️ TABLE: NodeEndpoint

**Seed Data:** 8 node endpoints

| Method | Endpoint | Response |
|--------|----------|----------|
| `GET` | `/api/ops/system/node-endpoints` | All endpoints + health |
| `GET` | `/api/ops/system/node-endpoints/health` | Health check results |
| `POST` | `/api/ops/system/node-endpoints` | Add new endpoint |
| `PUT` | `/api/ops/system/node-endpoints/[id]` | Update endpoint |

**Example Response:**
```json
{
  "total": 8,
  "healthy": 6,
  "degraded": 1,
  "down": 1,
  "endpoints": [
    {
      "provider_name": "Alchemy",
      "chain": "ethereum",
      "endpoint_url": "https://eth-mainnet.g.alchemy.com/...",
      "protocol": "http",
      "health_status": "healthy",
      "last_checked_at": "2024-12-15T10:29:00Z",
      "priority": 100
    }
  ]
}
```

---

## 📈 TABLE: PipelineMetric

**Seed Data:** Historical performance data

| Method | Endpoint | Response |
|--------|----------|----------|
| `GET` | `/api/ops/system/pipeline-metrics` | Recent metrics |
| `GET` | `/api/ops/system/pipeline-metrics/stats` | Aggregated statistics |

**Example Response:**
```json
{
  "recent_metrics": [
    {
      "chain": "ethereum",
      "block_number": 18950000,
      "throughput_tps": 45.3,
      "ingestion_latency_ms": 125,
      "decode_latency_ms": 78,
      "inserted_at": "2024-12-15T10:30:00Z"
    }
  ],
  "aggregated_24h": {
    "avg_throughput_tps": 42.8,
    "avg_ingestion_latency_ms": 130,
    "avg_decode_latency_ms": 82,
    "max_throughput_tps": 52.1
  }
}
```

---

## 📝 TABLE: AuditLog

**Seed Data:** ~50 audit entries

| Method | Endpoint | Response |
|--------|----------|----------|
| `GET` | `/api/admin/audit-logs` | All audit entries |
| `GET` | `/api/admin/audit-logs/[entityType]` | Filter by entity |
| `GET` | `/api/admin/audit-logs/user/[username]` | Filter by user |

**Example Response:**
```json
{
  "total": 49,
  "entries": [
    {
      "id": "audit-uuid",
      "action_type": "BLOCK",
      "entity_type": "wallet",
      "entity_id": "wallet-uuid",
      "user_identifier": "admin",
      "ip_address": "10.0.1.42",
      "details": {
        "wallet": "0x742d...",
        "risk_score": 85.2
      },
      "timestamp": "2024-12-15T10:30:00Z"
    }
  ]
}
```

---

## 🧠 TABLE: AI Assistant (No DB Direct)

| Method | Endpoint | Response |
|--------|----------|----------|
| `POST` | `/api/assistant/chat` | AI-generated response |

**Request:**
```json
{
  "message": "What's the risk status of wallet 0x742d...?",
  "context": {
    "wallet_address": "0x742d...",
    "case_id": "uuid"
  }
}
```

**Response:**
```json
{
  "response": "This wallet has been flagged with a risk score of 85.2...",
  "sources": ["wallet_details", "recent_alerts"],
  "confidence": 0.95
}
```

---

## 🔐 TABLE: User Warnings

**Seed Data:** Created dynamically (0 initial)

| Method | Endpoint | Response |
|--------|----------|----------|
| `GET` | `/api/user/[userId]/warnings` | User's warnings |
| `POST` | `/api/user/[userId]/warn` | Issue warning |
| `GET` | `/api/admin/warnings` | All warnings (admin only) |

---

## ⚫ TABLE: Blacklist

**Seed Data:** Empty (0 initial)

| Method | Endpoint | Response |
|--------|----------|----------|
| `GET` | `/api/blacklist` | All blacklisted addresses |
| `POST` | `/api/blacklist/add` | Add address (admin) |
| `DELETE` | `/api/blacklist/remove` | Remove address (admin) |

---

## 📊 TABLE: Admin Diagnostics (Special)

**No direct table - uses all 13 tables**

| Method | Endpoint | Response |
|--------|----------|----------|
| `GET` | `/api/admin/diagnostics/status` | DB health + counts |
| `GET` | `/api/admin/diagnostics/logs` | In-memory logs |
| `GET` | `/api/admin/diagnostics/seed-data` | Expected vs actual counts |
| `GET` | `/api/admin/diagnostics/endpoint-stats` | API call statistics |
| `DELETE` | `/api/admin/diagnostics/logs` | Clear all logs |

**Example Response:**
```json
{
  "database_health": "healthy",
  "ai_service": "available",
  "seed_data": {
    "users": {"expected": 5003, "actual": 5003},
    "wallets": {"expected": 5003, "actual": 5003},
    "transactions": {"expected": 25000, "actual": 24998},
    "alerts": {"expected": 500, "actual": 487}
  },
  "endpoint_stats": {
    "/api/wallet/details": {
      "total_calls": 142,
      "success_count": 140,
      "error_count": 2,
      "last_status_code": 200,
      "last_error": "Connection timeout"
    }
  }
}
```

---

## 🔌 Base URL

**Local Development:**
```
http://localhost:8000
```

**HF Spaces:**
```
https://[space-name].hf.space/api
```

---

## 🔑 Authentication

**Login (Get JWT Token):**
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

**Use Token in Requests:**
```bash
curl -H "Authorization: Bearer [token]" \
  http://localhost:8000/api/wallet/0x742d.../details
```

---

## 📊 Summary: Data by API Category

| Category | Tables | Key Endpoints |
|----------|--------|---------------|
| **Auth** | users | `/auth/login`, `/auth/register` |
| **Wallets** | wallets, risk_assessments | `/wallet/[address]/*` |
| **Transactions** | transactions, transaction_cases | `/transfers/*`, `/cases/*` |
| **Security** | alerts, blocked_transfers | `/alerts`, `/transfers/blocked` |
| **Compliance** | policy_rules, audit_logs | `/ops/compliance/*`, `/admin/audit-logs` |
| **AI/ML** | model_registry, feature_configs | `/ops/ai/*` |
| **Infrastructure** | node_endpoints, pipeline_metrics | `/ops/system/*` |
| **Notifications** | notification_events | `/notifications` |
| **Admin** | all tables | `/admin/diagnostics`, `/admin/*` |
