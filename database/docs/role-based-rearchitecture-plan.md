# Role-Based Rearchitecture Plan

## Objective
Transform the platform into 4 operational roles with clear visible UI responsibilities and hidden backend responsibilities:
- System Administrator
- AI and Data Engineer
- Security Analyst
- Compliance and Risk Manager

Authentication is temporarily disabled during this transition.

## Current Transition State
- Frontend auth context is running in disabled mode with a local admin profile.
- Login and register pages are disabled and show maintenance messages.
- Backend auth endpoints return 503 while AUTH_DISABLED=true.

## Target Domain Model

### Core enums
- role_type: SYSTEM_ADMIN, AI_DATA_ENGINEER, SECURITY_ANALYST, COMPLIANCE_RISK_MANAGER
- tx_status: PENDING, VERIFIED, FRAUD, IGNORED
- alert_status: NEW, ACKNOWLEDGED, IN_REVIEW, RESOLVED
- incident_action: CONFIRM_FRAUD, DISMISS, ESCALATE

### Core table changes

1. users
- Add role_type enum (replace free-text role over time)
- Add mfa_enabled boolean default false
- Add mfa_secret nullable
- Add last_password_reset_at timestamptz

2. transactions
- tx_hash varchar(66) primary key
- risk_score numeric(3,2) check (risk_score >= 0 and risk_score <= 1)
- status tx_status default PENDING
- assigned_to uuid references users(id)
- updated_at timestamptz default now()

3. transaction_cases
- id uuid pk
- tx_hash fk -> transactions(tx_hash)
- analyst_id fk -> users(id)
- state tx_status
- note text
- created_at, updated_at

4. audit_logs
- Enforce action_source_role
- Record before_value and after_value jsonb for sensitive config changes

5. node_endpoints
- id uuid pk
- provider_name text
- chain text
- endpoint_url text
- protocol text check (protocol in ('http','websocket'))
- priority int
- is_active bool
- health_status text
- last_error text
- last_checked_at timestamptz

6. pipeline_metrics
- id bigserial pk
- chain text
- block_number bigint
- throughput_tps numeric(10,2)
- ingestion_latency_ms int
- decode_latency_ms int
- inserted_at timestamptz default now()

7. feature_store_configs
- id uuid pk
- feature_key text unique
- enabled bool
- expression text
- owner_user_id uuid fk users(id)

8. model_registry
- id uuid pk
- model_name text
- version text
- artifact_uri text
- framework text check (framework in ('pkl','onnx','pt'))
- is_active bool
- promoted_by uuid fk users(id)
- promoted_at timestamptz

9. policy_rules
- id uuid pk
- rule_name text
- expression jsonb
- priority int
- is_active bool
- created_by uuid fk users(id)

10. address_labels
- address varchar(255) pk
- label_type text
- source text
- confidence numeric(3,2)
- updated_at timestamptz

## Backend Service Breakdown

1. Ingestion Service
- Webhook and polling receivers from Alchemy
- Decodes tx input data
- Writes normalized transaction records
- Circuit breaker and failover across node_endpoints

2. Rule Engine Service
- Runs hard rules before AI scoring
- Emits block, hold, or continue decisions

3. Inference Service
- Worker-based parallel scoring
- Feature extraction from recent windows
- Versioned model selection from model_registry

4. Case Management Service
- Handles Confirm Fraud, Dismiss, Escalate actions
- State machine transitions with audit logs
- Triggers downstream actions (temporary freeze, notifications)

5. Compliance Reporting Service
- Aggregation jobs for weekly and monthly reports
- Exports CSV/PDF

## UI Modules Per Role

1. System Administrator
- Node connection manager
- Pipeline observability dashboard
- User and RBAC management
- Audit timeline viewer

2. AI and Data Engineer
- Feature toggles and definitions
- Model upload and active version switch
- Backtesting runner and result comparison

3. Security Analyst
- Real-time alert board with severity channels
- Transaction graph visualizer
- Case action console: confirm, dismiss, escalate

4. Compliance and Risk Manager
- Policy rule editor
- Blacklist and whitelist manager
- Executive report center

## Event Flow Example
1. Ingestion service receives suspicious transaction.
2. Rule engine applies hard rules.
3. Inference service computes risk_score.
4. Alert board receives high-risk event.
5. Analyst confirms fraud.
6. Case state becomes FRAUD.
7. Action trigger executes freeze logic and notification.
8. Full action trail is stored in audit_logs.

## Delivery Phases

### Phase 1
- Complete auth-disabled transition (done)
- Add enum types and schema migration baseline
- Introduce tx_status and assigned analyst fields

### Phase 2
- Build role-specific route groups and navigation
- Implement node endpoint manager and pipeline metrics UI
- Add model registry API and feature store API

### Phase 3
- Implement real-time alert board and case state machine
- Integrate notification adapters (Slack and Telegram)
- Add policy execution layer

### Phase 4
- Reporting and compliance exports
- Hardening, SLO metrics, audit completeness checks

## Immediate next implementation target
- Database migration set for transactions constraints and role enums.
- API contracts for case management actions.
- New frontend app sections per role under src/app/roles.
