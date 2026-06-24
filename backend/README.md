# Backend - AI Service & Legacy Code

## 📁 Structure

This directory contains both the legacy FastAPI monolith and the extracted AI service router.

### Files
```
backend/
├── app/
│   ├── main.py                 # Legacy monolith (being phased out)
│   ├── ai_router.py            # ✅ NEW: AI-only router (extracted from main.py)
│   ├── auth.py                 # Authentication middleware & schemas
│   ├── case_management.py      # Case management endpoints (Phase 2)
│   ├── phase2_ops.py           # Operations endpoints (Phase 2)
│   ├── phase3_governance.py    # Governance endpoints (Phase 3)
│   ├── phase4_reporting.py     # Reporting endpoints (Phase 4)
│   ├── admin_diagnostics.py    # Admin diagnostic utilities
│   ├── core/                   # Database, config, security
│   ├── models/                 # SQLAlchemy ORM models
│   ├── services/               # Business logic services
│   │   ├── ai_engine.py        # Multi-agent AI detection engine
│   │   ├── ai_agent_improvements.py
│   │   ├── etherscan_service.py # Blockchain data fetcher
│   │   ├── persistence.py      # DB persistence logic
│   │   ├── hf_security_analyst.py
│   │   └── assistant_knowledge_base.py
│   └── utils/                  # Helper utilities
├── tests/                      # pytest test suite
└── requirements.txt            # Python dependencies
```

### ai_router.py vs main.py

| Aspect | ai_router.py | main.py |
|--------|---------|---------|
| Purpose | AI/ML endpoints only | Legacy monolith with all endpoints |
| Status | ✅ Active (extracted) | ⚠️ Phasing out |
| Contains | `/analyze`, `/predict`, `/assistant/chat`, `/feedback`, `/diagnostics/alchemy` | All other endpoints (auth, wallets, alerts, transfers, orgs, etc.) |

### Backend Services (Microservices)

The actual running services are in `/services`:
- **Auth Service** (Node.js, port 3001) → JWT, registration, spam detection
- **Wallet Service** (Node.js, port 3002) → Wallet CRUD, balances, connections
- **Alert Service** (Node.js, port 3003) → Alert management, notifications
- **Transfer Service** (Node.js, port 3004) → Protected transfers, blocked transfers
- **Analytics Service** (Python, port 3005) → Pipeline metrics, SLO, organizations
- **Compliance Service** (Node.js, port 3006) → Policy rules, KYC, watchlist
- **Event Service** (Node.js, port 3007) → WebSocket, real-time events, SNS
- **AI Service** (Python, port 8000) → Risk analysis, ML predictions, assistant

## 🚀 Quick Start (AI Service only)

```bash
# Install dependencies (from repo root)
pip install -r requirements.txt

# Run AI service
uvicorn app.main:app --reload --port 8000
```

## 🗄️ Database

- Single PostgreSQL database (`blockchain_main`) on port 5432
- Init scripts: `../database/init.sql`, `../database/migrate_sync_columns.sql`
- Models defined in `app/models/models.py`

### Key Tables
- `wallets` - Wallet addresses, risk scores, status
- `transactions` - Blockchain transactions (partitioned by month)
- `alerts` - Security alerts with chain_id filter
- `blocked_transfers` - Blocked transfer attempts
- `risk_assessments` - Historical AI risk scores
- `blacklist` - Blacklisted addresses
- `organizations` - Multi-tenant orgs
- `feedback_labels` - Admin feedback for ML retraining
- `model_registry` - ML model versions

## 🔐 Authentication

- JWT tokens (OAuth2PasswordBearer)
- API Key support (x-api-key header)
- Rate limiting (slowapi)
- Spam detection for registration

## 🧪 Testing

```bash
# Run backend tests
pytest backend/tests/

# Run with coverage
pytest backend/tests/ --cov=app --cov-report=html
```

## 📝 Notes

- **Do NOT add new endpoints to `main.py`.** Use microservices in `/services`.
- The `/ai_router.py` was extracted to separate AI logic from legacy monolith.
- Legacy endpoints in `main.py` will be gradually migrated to `/services`.

## 🔗 Related Docs

- [Architecture Refactor Plan](../../docs/ARCHITECTURE_REFACTOR_TO_MICROSERVICES.md)
- [Migration Plan](../../docs/MICROSERVICES_MIGRATION_PLAN.md)
- [API Gateway Routes](../../services/api-gateway/README.md)

---
© 2026 Blockchain AI Sentinel Team