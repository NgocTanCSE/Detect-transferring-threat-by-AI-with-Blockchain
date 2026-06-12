## 🗺️ Database Relationships & Data Dependencies

```
┌──────────────────────────────────────────────────────────────────────┐
│                     CORE ENTITIES (Seed Data)                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                          ┌─────────┐                                 │
│                          │  Users  │                                 │
│                          │ (5,003) │  ← admin, analyst, user         │
│                          └────┬────┘      + 5000 demo_user_*         │
│                               │                                      │
│         ┌─────────────────────┼──────────────────────┐              │
│         │                     │                      │              │
│    ┌────▼──────┐         ┌───▼────┐          ┌─────▼─────┐         │
│    │ Wallets   │         │ Audit  │          │ User      │         │
│    │ (5,003)   │         │ Logs   │          │ Warnings  │         │
│    │ risk 5-95 │         │ (50)   │          │ (varies)  │         │
│    └────┬──────┘         └────────┘          └───────────┘         │
│         │                                                           │
│    ┌────▼──────────────────┐                                       │
│    │                       │                                       │
│ ┌──▼──────────┐      ┌────▼───────┐                              │
│ │Transactions │      │ Risk        │                              │
│ │  (~25,000)  │      │ Assessments │                              │
│ │  tx_hash    │      │             │                              │
│ │  from/to    │      └─────────────┘                              │
│ │  value      │                                                   │
│ │  risk_score │                                                   │
│ └──┬─────────┬┘                                                   │
│    │         │                                                    │
│    │    ┌────▼───────────────┐                                   │
│    │    │ Transaction Cases  │                                   │
│    │    │      (~400)        │                                   │
│    │    │  analyst_id ──────┐│                                   │
│    │    │  state, action    ││                                   │
│    │    └────────────────────┘│                                  │
│    │                           │ (FK to users)                    │
│    │                                                             │
│    └─────────────────────┬──────────────────────────────────┐    │
│                          │                                  │    │
│                    ┌─────▼────────┐              ┌─────────▼─┐ │
│                    │ Blocked      │              │ Alerts    │ │
│                    │ Transfers    │              │  (~500)   │ │
│                    │  (~300)      │              │ severity  │ │
│                    │ risk_score   │              │ risk_score│ │
│                    └──────────────┘              └───────────┘ │
│                                                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔗 Foreign Key Relationships

```
User (id) ──┬──► TransactionCase.analyst_id
            ├──► BlockedTransfer.sender_user_id
            ├──► PolicyRule.created_by
            ├──► ModelRegistry.promoted_by
            ├──► FeatureStoreConfig.owner_user_id
            └──► UserWarning.user_id

Wallet (id) ──► RiskAssessment.wallet_id

Transaction (id) ──► TransactionCase.tx_hash (string FK)
```

---

## 📊 Data Volumes (After Seed)

```
users               5,003    (5000 + 3 test)
├─ admin roles      3        (admin, analyst, user)
├─ regular users    5,000    (demo_user_*)
└─ active          5,003     (all active)

wallets             5,003    (1 per user + 3 test)
├─ active          4,500     (90%)
├─ suspended        300       (6%)
├─ under_review     200       (4%)
└─ frozen            3        (test wallets special)

transactions       ~25,000    (5 per user)
├─ success         24,750     (99%)
└─ failed            250      (1%)

alerts              ~500      (for risk_score >= 60)
├─ CRITICAL         100       (risk >= 85)
└─ HIGH             400       (risk >= 60)

blocked_transfers   ~300      (sample of risky attempts)

transaction_cases  ~400       (first 400 TXs get cases)
├─ PENDING         100
├─ VERIFIED        100
├─ FRAUD            100
└─ IGNORED         100

audit_logs         ~50        (first 50 users)

notification_events ~60       (alert notifications)
├─ slack           15
├─ email           15
├─ webhook         15
└─ telegram        15

policy_rules        3         (governance rules)

model_registry      3         (ML models)
├─ active          1
└─ inactive        2

feature_configs    12         (ML feature toggles)

node_endpoints      8         (blockchain providers)

user_warnings      ~0         (created as needed)

blacklist          ~0         (admin-managed)

token_transfers    ~0         (scanner-populated)

risk_assessments   ~0         (audit trail)

feedback_labels    ~0         (admin training feedback)
```

---

## 🔄 Data Read/Write Flow

### ✍️ Write Operations (CREATE/UPDATE)

**Seed Time (Entrypoint):**
```python
seed_wallets.py
├─ INSERT 5003 users
├─ INSERT 5003 wallets
├─ INSERT ~25,000 transactions
├─ INSERT ~500 alerts
├─ INSERT ~300 blocked_transfers
├─ INSERT ~400 transaction_cases
├─ INSERT ~50 audit_logs
├─ INSERT ~60 notification_events
├─ INSERT 3 policy_rules
├─ INSERT 3 model_registry entries
├─ INSERT 12 feature_configs
└─ INSERT 8 node_endpoints
```

**Runtime (API Endpoints):**
```
POST /api/auth/register
  └─ INSERT users, wallets

POST /api/assist/chat
  └─ INSERT audit_logs (conversation logging)

POST /ops/security/case
  └─ INSERT/UPDATE transaction_cases

PUT /ops/compliance/policy-rules
  └─ UPDATE policy_rules

POST /webhook/alert
  └─ INSERT alerts, notification_events
```

### 📖 Read Operations (SELECT)

**Dashboard (`/`):**
```
GET /api/statistics/dashboard
  ├─ COUNT(users)
  ├─ COUNT(wallets)
  ├─ COUNT(transactions)
  ├─ COUNT(alerts)
  ├─ SUM(blocked_transfers.amount) WHERE blocked_at > now-7d
  └─ COUNT(notification_events) WHERE status='queued'

GET /api/transfers/flow-stats
  ├─ SELECT SUM(value) FROM transactions
  │   WHERE from_address IN (high_risk_wallets)
  │   AND timestamp > now-24h
  └─ [Same for receiver]

GET /api/transfers/blocked
  ├─ SELECT * FROM blocked_transfers
  │   ORDER BY blocked_at DESC
  │   LIMIT 20
  └─ Risk distribution by block_reason
```

**Wallet Insight (`/insights/wallet/[address]`):**
```
GET /api/wallet/[address]/details
  ├─ SELECT * FROM wallets WHERE address=?
  ├─ SELECT COUNT(*) FROM transactions WHERE from=?
  ├─ SELECT COUNT(*) FROM transactions WHERE to=?
  ├─ SELECT * FROM alerts WHERE wallet_address=?
  └─ SELECT * FROM risk_assessments WHERE wallet_id=?

GET /api/wallet/[address]/transactions
  └─ SELECT * FROM transactions WHERE from=? OR to=?
```

**Admin Diagnostics (`/admin/diagnostics`):**
```
GET /api/admin/diagnostics/status
  ├─ SELECT COUNT(*) FROM users
  ├─ SELECT COUNT(*) FROM wallets
  ├─ ... (all 13 tables)
  └─ Check database connectivity

GET /api/admin/diagnostics/logs
  └─ Return in-memory diagnostic log (not DB)

GET /api/admin/diagnostics/endpoint-stats
  └─ Return endpoint call statistics (not DB)
```

---

## 🗄️ Indexed Fields (Fast Queries)

```
users
  ├─ username (unique)
  ├─ email (unique)
  └─ wallet_address

wallets
  ├─ address (unique)
  └─ risk_category

transactions
  ├─ tx_hash (unique)
  ├─ from_address
  ├─ to_address
  ├─ timestamp
  └─ case_status

alerts
  ├─ wallet_address
  └─ detected_at

blocked_transfers
  ├─ sender_address
  ├─ receiver_address
  └─ blocked_at

transaction_cases
  ├─ tx_hash
  └─ analyst_id

audit_logs
  ├─ action_type
  └─ timestamp

notification_events
  ├─ channel
  ├─ severity
  └─ status

policy_rules
  ├─ rule_name (unique)
  └─ is_active

model_registry
  ├─ model_name
  └─ is_active

feature_store_configs
  ├─ feature_key (unique)
  └─ enabled

node_endpoints
  ├─ provider_name
  ├─ chain
  └─ is_active

pipeline_metrics
  ├─ chain
  └─ block_number
```

---

## 💾 Data Persistence

```
Location: /data/blockchain_local.db (SQLite)

Backup Strategy:
├─ Auto-backup on migration (migrate_persistent_storage.py)
│  └─ Filename: blockchain_local.db.backup.YYYYMMDD_HHMMSS.db
└─ Manual via: rm /data/blockchain_local.db && rebuild Space

Retention:
├─ Persists across Space restarts ✅
├─ Persists across Space rebuilds ✅ (unless manually deleted)
└─ No TTL/auto-cleanup (permanent until manually deleted)

Size Estimate:
├─ 5000 users:           ~500 KB
├─ 5000 wallets:         ~1 MB
├─ 25000 transactions:   ~10 MB
├─ Other data:           ~2 MB
└─ Total:               ~13 MB (likely grows to 50-100 MB in prod)
```

---

## 🔄 Data Consistency & Relationships

**Integrity Constraints:**
```
- username (UNIQUE)
- email (UNIQUE)
- wallet_address (UNIQUE in wallets, unique per user in users)
- tx_hash (UNIQUE)
- rule_name (UNIQUE)
- feature_key (UNIQUE)
- address (UNIQUE in blacklist, in wallets)
```

**Foreign Key Integrity:**
```
- User deletion cascades to: UserWarning, AuditLog
- Wallet deletion cascades to: RiskAssessment
- User references in:
  ├─ Transaction.assigned_to (nullable)
  ├─ TransactionCase.analyst_id (nullable)
  ├─ BlockedTransfer.sender_user_id (nullable)
  ├─ PolicyRule.created_by (nullable)
  ├─ ModelRegistry.promoted_by (nullable)
  └─ FeatureStoreConfig.owner_user_id (nullable)
```

**Data Consistency Checks:**
```
- Risk scores: 0.0 - 100.0
- Normalized risk: 0.00 - 1.00
- Warning count: 0 - 3 (suspends at 3)
- Transaction status: 1 (success) or 0 (failed)
- Account status: active, suspended, frozen, under_review
- Risk category: money_laundering, manipulation, scam, NULL
```

---

## 📈 Query Performance Notes

**Fast Queries (<100ms):**
- COUNT(*) with indexes
- Single wallet lookup by address
- User lookup by username/email
- Recent transactions (timestamp index)
- Active alerts (detected_at index)

**Potentially Slow (>1s with 1M+ records):**
- Full table scans (COUNT without index)
- JOIN transactions + wallets + users (3-way join)
- Aggregate risk by category (GROUP BY)
- Time-range scans on large tables (need compound indexes)

**Optimization Tips:**
```sql
-- ✅ FAST: Use indexed fields
SELECT * FROM wallets WHERE address = '0x...'
SELECT * FROM transactions WHERE from_address = '0x...' AND timestamp > now-7d

-- ❌ SLOW: Full scans
SELECT * FROM transactions WHERE CAST(value AS FLOAT) > 10
SELECT * FROM alerts WHERE message ILIKE '%fraud%'

-- ✅ FAST: Use GROUP BY with indexes
SELECT risk_category, COUNT(*) FROM wallets WHERE is_active GROUP BY risk_category
SELECT severity, COUNT(*) FROM alerts WHERE detected_at > now-1d GROUP BY severity
```

---

## 🔐 Seed Data Passwords Reference

**All demo users** (5000):
```
Username: demo_user_00000 to demo_user_04999
Password: demo123 (plaintext in DB)
Roles: Distributed (1 admin, ~294 analyst, rest user)
```

**Test accounts** (3):
```
admin     / admin123      (role: admin)
analyst   / analyst123    (role: analyst)
user      / user123       (role: user)
```

**Password Verification:**
```python
# In auth.py:verify_password()
def verify_password(plain: str, hashed: str) -> bool:
    if plain == hashed:  # Plaintext seed data
        return True
    return pwd_context.verify(plain, hashed)  # Bcrypt production data
```

**Migration to Production:**
- Change `get_password_hash()` to always hash
- Re-hash all plaintext passwords in DB
- Or accept that seed data is dev-only
