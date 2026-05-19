## 📊 Database Schema & Data Flow

### 🏗️ Complete Database Structure (13 Tables)

All data là **persistent** được lưu tại `/data/blockchain_local.db` (SQLite) trên HF Spaces.

---

## Table 1: **Users** (`users`)
| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `username` | String | Login username (unique) |
| `email` | String | Email (unique) |
| `password_hash` | String | Authentication password (plaintext in seed for dev) |
| `role` | String | admin, analyst, user |
| `wallet_address` | String | Associated wallet |
| `is_active` | Boolean | Account status |
| `warning_count` | Integer | Warning counter (3 strikes = suspension) |
| `last_login_at` | DateTime | Last login timestamp |
| `created_at`, `updated_at` | DateTime | Metadata |

**Seed Data:**
- 5000 demo users: `demo_user_00000` → `demo_user_04999` (all password: `demo123`)
- 3 test accounts: `admin`, `analyst`, `user` (same password: `demo123`)

**Where It's Visible:**
- 🔐 Authentication pages `/login`, `/register`
- 👤 User profile sidebar
- 📊 Admin dashboard (user count, roles)

---

## Table 2: **Wallets** (`wallets`)
| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `address` | String | Ethereum wallet address (unique) |
| `label` | String | Human-readable name |
| `entity_type` | String | User, Exchange, Contract |
| `account_status` | String | active, suspended, frozen, under_review |
| `risk_score` | Float | 0.0 - 100.0 |
| `risk_category` | String | money_laundering, manipulation, scam |
| `total_transactions` | BigInt | TX count |
| `total_value_sent`, `total_value_received` | Decimal | ETH amounts |
| `first_seen_at`, `last_activity_at` | DateTime | Activity timeline |
| `flagged_at`, `flagged_by` | DateTime, String | Manual flags |
| `notes` | Text | Admin notes |

**Seed Data:**
- 5000 wallets (1 per user + 3 test wallets)
- Risk scores: 5-95 (distribution: low 20%, medium 50%, high 30%)
- Random account statuses

**Where It's Visible:**
- 💰 Wallet insight page `/insights/wallet/[address]`
- 📈 Dashboard stats (total wallets, risk distribution)
- ⚙️ Admin diagnostics (wallet counts)

---

## Table 3: **Transactions** (`transactions`)
| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `tx_hash` | String | Ethereum TX hash (unique) |
| `from_address`, `to_address` | String | Sender, receiver |
| `value` | Decimal | ETH amount |
| `block_number` | BigInt | Blockchain block |
| `timestamp` | DateTime | TX timestamp |
| `gas_price`, `gas_used` | Decimal, BigInt | Fee data |
| `input_data` | Text | Contract call data |
| `status` | SmallInt | 1=success, 0=failed |
| `normalized_risk_score` | Decimal | 0.00-1.00 |
| `case_status` | String | PENDING, VERIFIED, FRAUD, IGNORED |
| `assigned_to` | UUID → User | Analyst assignment |
| `is_flagged` | Boolean | Manual flag |
| `flag_reason` | String | Why flagged |

**Seed Data:**
- ~25,000 transactions (5 per user × 5000)
- Realistic timestamps over 180 days
- Risk scores from transaction data

**Where It's Visible:**
- 📋 Transaction case page `/insights/case/[txHash]`
- 📊 Flow stats (inflow/outflow by risk level)
- 🚨 Blocked transfers dashboard
- ⚙️ Admin diagnostics (TX counts, case statuses)

---

## Table 4: **Alerts** (`alerts`)
| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `wallet_address` | String | Which wallet |
| `alert_type` | String | Risk Spike, Unusual Activity, etc. |
| `severity` | String | CRITICAL, HIGH, MEDIUM, LOW |
| `message` | Text | Human-readable alert |
| `risk_score` | Float | Associated risk |
| `metadata` | JSONB | Extra details |
| `detected_at` | DateTime | Alert timestamp |
| `acknowledged` | Boolean | Admin acknowledged? |
| `acknowledged_at`, `acknowledged_by` | DateTime, String | Who acknowledged |

**Seed Data:**
- ~500 alerts (for wallets with risk_score ≥ 60)
- Mix of CRITICAL (≥85) and HIGH (≥60)
- 25% are acknowledged

**Where It's Visible:**
- 🚨 Dashboard alerts panel
- 📊 Security analyst panel `/admin/dashboard` → "Alerts Summary"
- 📲 Notification events (triggered by alerts)
- ⚙️ Admin diagnostics (alert count)

---

## Table 5: **BlockedTransfers** (`blocked_transfers`)
| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `sender_address` | String | Who tried to send |
| `receiver_address` | String | Who they tried to send to |
| `amount` | Decimal | ETH amount attempted |
| `risk_score` | Float | Sender's risk at time |
| `block_reason` | String | Why it was blocked |
| `user_warning_count` | Integer | User's warning at time |
| `sender_user_id` | UUID → User | User who sent (if applicable) |
| `blocked_at` | DateTime | When blocked |

**Seed Data:**
- ~300 blocked transfers
- Blocked reasons: "High risk threshold exceeded"
- Distributed over 21-day period

**Where It's Visible:**
- 📊 Dashboard "Blocked Transfers" widget
- 📋 Admin panel → blocked transfers log
- 📈 Flow stats endpoint
- ⚙️ Admin diagnostics (blocked count)

---

## Table 6: **TransactionCases** (`transaction_cases`)
| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `tx_hash` | String | Which transaction |
| `analyst_id` | UUID → User | Assigned analyst |
| `action` | String | ASSIGN, CONFIRM_FRAUD, DISMISS, ESCALATE |
| `state` | String | PENDING, VERIFIED, FRAUD, IGNORED |
| `note` | Text | Analyst notes |
| `created_at`, `updated_at` | DateTime | Timeline |

**Seed Data:**
- ~400 cases (from first 400 transactions)
- Random assignment to demo users
- Mixed states & actions

**Where It's Visible:**
- 📋 Case insight page `/insights/case/[txHash]`
- 👨‍💼 Compliance manager panel → "Case Summary"
- ⚙️ Admin diagnostics (case counts by state)

---

## Table 7: **Blacklist** (`blacklist`)
| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `address` | String | Blacklisted wallet |
| `category` | String | scam, sanctioned, etc. |
| `source` | String | Where it came from |
| `severity` | String | HIGH, MEDIUM, LOW |
| `is_active` | Boolean | Still blacklisted? |
| `reported_at`, `verified_at`, `expires_at` | DateTime | Timeline |

**Seed Data:**
- Created but typically empty (no seeded entries)
- Used for manual admin additions

**Where It's Visible:**
- 🚨 Policy rule evaluation (blocks blacklisted)
- 🔒 Admin blacklist management page

---

## Table 8: **AuditLog** (`audit_logs`)
| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `action_type` | String | CREATE, UPDATE, BLOCK, REVIEW, EXPORT |
| `entity_type` | String | wallet, transaction, user |
| `entity_id` | UUID | Which entity |
| `user_identifier` | String | Username who did it |
| `ip_address` | String | Source IP |
| `details` | JSONB | Full context |
| `timestamp` | DateTime | When |

**Seed Data:**
- ~50 audit logs (first 50 demo users)
- Random actions on wallets
- IP addresses from 10.0.x.x range

**Where It's Visible:**
- 📋 Admin audit trail page (compliance)
- 🔍 Forensics & investigation
- ⚙️ Admin diagnostics (audit count)

---

## Table 9: **UserWarning** (`user_warnings`)
| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `user_id` | UUID → User | Which user got warned |
| `wallet_address` | String | For which wallet |
| `target_address` | String | Who they tried to interact with |
| `warning_type` | String | Type of warning |
| `risk_score` | Float | Risk at time of warning |
| `user_action` | String | ignored, cancelled, reported |
| `warning_number` | Integer | 1st, 2nd, or 3rd warning |

**Seed Data:**
- Created as needed for at-risk users
- Tracks 3-strike suspension system

**Where It's Visible:**
- 👤 User profile (warning count)
- 📊 Admin user management
- 🔐 Account suspension logic

---

## Table 10: **NotificationEvent** (`notification_events`)
| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `channel` | String | slack, telegram, email, webhook |
| `recipient` | String | Target email/username |
| `severity` | String | LOW, MEDIUM, HIGH, CRITICAL |
| `message` | Text | What to send |
| `status` | String | queued, sent, failed |
| `metadata` | JSONB | Extra context |
| `created_at`, `sent_at` | DateTime | Timeline |

**Seed Data:**
- ~60 notification events
- Mixed channels, severities, statuses
- 33% are marked as "sent"

**Where It's Visible:**
- 🔔 Admin notifications panel
- 📊 Compliance manager → "Notifications"
- 📲 Outbound notification queue
- ⚙️ Admin diagnostics (notification count)

---

## Table 11: **PolicyRule** (`policy_rules`)
| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `rule_name` | String | Friendly name (unique) |
| `description` | Text | What it does |
| `min_risk_score` | Float | Threshold |
| `block_blacklisted` | Boolean | Block blacklist matches? |
| `block_suspended` | Boolean | Block suspended wallets? |
| `notify_on_block` | Boolean | Send alert? |
| `priority` | Integer | Evaluation order |
| `is_active` | Boolean | Enabled? |
| `created_by` | UUID → User | Which admin created |

**Seed Data:**
- 3 policy rules:
  1. "Block High Risk Transfers" (80.0 risk, priority 10)
  2. "Monitor Suspicious Velocity" (60.0 risk, priority 20)
  3. "Require Manual Review for New Wallets" (45.0 risk, priority 30)

**Where It's Visible:**
- ⚖️ Compliance manager → "Policy Rules" tab
- 🚨 Transfer decision engine (blocking logic)
- 📋 Admin policy management page
- ⚙️ Admin diagnostics (rule count)

---

## Table 12: **ModelRegistry** (`model_registry`)
| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `model_name` | String | Model identifier |
| `version` | String | Semantic version |
| `artifact_uri` | String | S3/storage path |
| `framework` | String | pkl, onnx, pt |
| `is_active` | Boolean | Used for inference? |
| `promoted_by`, `promoted_at` | UUID, DateTime | Who deployed |

**Seed Data:**
- 3 models:
  1. `risk_detector v1.4.0` (active, pkl)
  2. `transaction_graph_model v2.1.0` (inactive, onnx)
  3. `wallet_clustering_model v0.9.1` (inactive, pt)

**Where It's Visible:**
- 🤖 AI Data Engineer panel → "Active Models"
- 📊 Model promotion/deployment UI
- ⚙️ Admin diagnostics (model count)

---

## Table 13: **FeatureStoreConfig** (`feature_store_configs`)
| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `feature_key` | String | Feature name (unique) |
| `enabled` | Boolean | Feature toggle |
| `expression` | String | How to calculate it |
| `owner_user_id` | UUID → User | Responsible data scientist |

**Seed Data:**
- 12 features: `feature_00` → `feature_11`
- 75% enabled, 25% disabled
- Expressions like `risk_score >= 40`

**Where It's Visible:**
- 🤖 AI Data Engineer panel → "Feature Store"
- ⚙️ Model training pipeline
- 📊 Admin diagnostics (feature count)

---

## ⚙️ Additional System Tables

### **NodeEndpoint** (`node_endpoints`)
- RPC provider configuration (Alchemy, Infura, etc.)
- Health monitoring
- Seed: 8 endpoints (mix of chains & providers)

### **PipelineMetric** (`pipeline_metrics`)
- TX ingestion performance metrics
- Throughput, latency tracking
- Seed: Historical pipeline performance data

### **RiskAssessment** (`risk_assessments`)
- Historical snapshots of wallet risk scores
- Model version tracking
- Linked to Wallet via foreign key

### **TokenTransfer** (`token_transfers`)
- ERC20/ERC721 token movement history
- Alchemy data source
- Typically populated by scanner service

### **FeedbackLabel** (`feedback_labels`)
- Admin feedback for model retraining
- Links AI predictions to admin corrections
- Used for supervised learning loop

---

## 📊 Dashboard Data Visibility

### 🎯 Main Dashboard (`/app/page.tsx`)

```
┌─────────────────────────────────────────────────────┐
│          BLOCKCHAIN RISK ASSESSMENT DASHBOARD        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Cards (From database):                             │
│  • Total Users: SELECT COUNT(*) FROM users          │
│  • Total Wallets: SELECT COUNT(*) FROM wallets      │
│  • Total Transactions: SELECT COUNT(*) FROM txns    │
│  • Alerts: SELECT COUNT(*) FROM alerts              │
│                                                     │
│  Role-based Panels:                                 │
│  ├─ System Admin                                    │
│  │  └─ Node endpoints, Pipeline metrics             │
│  │     (from node_endpoints, pipeline_metrics)      │
│  │                                                  │
│  ├─ AI Data Engineer                                │
│  │  └─ Feature store, Model registry                │
│  │     (from feature_store_configs, model_registry) │
│  │                                                  │
│  ├─ Security Analyst                                │
│  │  └─ Alerts, Cases, Notifications                 │
│  │     (from alerts, transaction_cases,             │
│  │      notification_events)                        │
│  │                                                  │
│  └─ Compliance Manager                              │
│     └─ Policy rules, Reports                        │
│        (from policy_rules, transactions)            │
│                                                     │
│  Flow Statistics Widget:                            │
│  • High-risk inflow/outflow                         │
│    (from transactions WHERE risk >= threshold)      │
│                                                     │
│  Blocked Transfers Widget:                          │
│  • Recent blocks + counts                           │
│    (from blocked_transfers ORDER BY blocked_at)     │
│                                                     │
│  Chat Widget (Global):                              │
│  • AI Assistant for analysis                        │
│    (HuggingFace API, no DB dependency)              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 🔍 Wallet Insight (`/insights/wallet/[address]`)
```
Uses: wallets, transactions, alerts, risk_assessments
- Risk score & category
- TX history (inflow/outflow)
- Related alerts
- Account status
```

### 📋 Case Insight (`/insights/case/[txHash]`)
```
Uses: transactions, transaction_cases, users, wallets
- TX details
- Case history (actions, states)
- Assigned analyst
- Sender/receiver risk profiles
```

### ⚖️ Compliance Manager (`/admin/dashboard?view=compliance`)
```
Uses: policy_rules, transactions, notification_events, audit_logs
- Active policy rules
- Case summary
- Blocked transfers
- Notification queue
```

### 👨‍💼 Admin Diagnostics (`/admin/diagnostics`)
```
Uses ALL tables:
Tab 1: Overview
  └─ DB connectivity, HF AI service status, seed counts

Tab 2: Seed Data
  └─ Row counts per table (expected vs actual)

Tab 3: Endpoints
  └─ Per-endpoint call statistics, error rates

Tab 4: Logs
  └─ Diagnostic log entries (filterable by type)
```

---

## 🔄 Data Flow & Persistence

```
┌─────────────────────────────────────────────────────────┐
│           SEED DATA CREATION (entrypoint.sh)            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. seed_wallets.py GENERATES:                          │
│     └─ 5000 demo users (demo_user_00000-04999)         │
│     └─ 3 test users (admin, analyst, user)             │
│     └─ 5000+ wallets (1 per user + 3 test)             │
│     └─ ~25,000 transactions (5 per user)               │
│     └─ ~500 alerts (for high-risk wallets)             │
│     └─ ~300 blocked transfers                          │
│     └─ ~400 transaction cases                          │
│     └─ ~50 audit logs                                  │
│     └─ ~60 notification events                         │
│     └─ 3 policy rules                                  │
│     └─ 3 ML models (registry entries)                  │
│     └─ 12 feature configs                              │
│     └─ 8 node endpoints                                │
│                                                         │
│  2. WRITTEN TO:                                         │
│     └─ /data/blockchain_local.db (SQLite)              │
│        ↓                                                │
│     PERSISTENT across HF Space restarts!               │
│                                                         │
│  3. ACCESSED BY:                                        │
│     ├─ Backend (FastAPI) via SQLAlchemy                │
│     ├─ Frontend (Next.js) via /api/* endpoints         │
│     └─ Admin via /admin/diagnostics                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🗂️ Data Organization Summary

| Category | Tables | Count | Where Visible |
|----------|--------|-------|---------------|
| **User Management** | users, user_warnings | 5,003 users | Dashboard, profile pages |
| **Blockchain Data** | wallets, transactions, token_transfers | 5,000+ wallets, 25,000 TXs | Insights, flow stats |
| **Security** | alerts, blacklist, blocked_transfers | ~500 alerts, ~300 blocks | Dashboard, security panel |
| **Operations** | transaction_cases, audit_logs | ~400 cases, ~50 logs | Compliance, forensics |
| **Notifications** | notification_events | ~60 events | Admin panel |
| **Governance** | policy_rules | 3 rules | Policy manager |
| **ML/AI** | model_registry, feature_store_configs | 3 models, 12 features | AI panel |
| **Infrastructure** | node_endpoints, pipeline_metrics | 8 endpoints, metrics | System admin panel |

---

## ✅ Password Storage (Dev Mode)

**Seed Data Passwords:** Plaintext `demo123` for all users
```
- demo_user_00000 / demo123
- admin / admin123
- analyst / analyst123
- user / user123
```

**Auth Handler:** `auth.py:verify_password()`
1. Try plaintext comparison (seed data) ✓
2. Try bcrypt (production data) ✓
3. Return False if both fail

**Production:** Passwords will be bcrypt hashed via `get_password_hash()`

---

## 🔐 Storage Location

**Data Path:** `/data/blockchain_local.db`
- **Persistent:** YES (survives Space rebuilds)
- **Type:** SQLite
- **Size:** ~50-100 MB (5000 users + data)
- **Clear:** `rm /data/blockchain_local.db` then rebuild

**Migration:** Automatic on first startup via `migrate_persistent_storage.py`
