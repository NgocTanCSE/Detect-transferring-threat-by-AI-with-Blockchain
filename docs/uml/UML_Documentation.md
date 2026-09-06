# Blockchain AI Sentinel — Comprehensive Enterprise UML Architecture Documentation

This directory contains the complete, production-grade PlantUML source specifications and rendered high-resolution architecture diagrams for the **Blockchain AI Sentinel Platform** (14-Container Microservices Architecture, API Gateway Circuit Breaker, RabbitMQ Event-Driven Mesh, FastAPI Multi-Agent AI Sentinel, Gemini Copilot, Monthly Partitioned PostgreSQL, Autonomous Chain Scanner).

---

## 🗺️ Master Diagram Index (20 Architectural Diagrams)

| # | Diagram Name | File | Type | Architectural Focus |
|---|--------------|------|------|---------------------|
| 1 | **C4 Container Diagram** | [`UML_container-diagram.png`](file:///home/ngoctan/Downloads/blockchain-ai-project/docs/uml/UML_container-diagram.png) | C4 Level 2 | Complete container architecture: Next.js SOC Dashboard, Node.js API Gateway, 7 Microservices, FastAPI AI Engine, Scanner, Alchemy Web3, RabbitMQ & Partitioned Postgres |
| 2 | **Microservices Event Mesh** | [`UML_microservices-event-architecture.png`](file:///home/ngoctan/Downloads/blockchain-ai-project/docs/uml/UML_microservices-event-architecture.png) | Component | API Gateway routing with Opossum Circuit Breakers, RabbitMQ Topic Exchanges, Queues, Dead Letter Queues (DLQ), and Socket.IO Event Service |
| 3 | **AI Sentinel Internal Components** | [`UML_ai-threat-detection-components.png`](file:///home/ngoctan/Downloads/blockchain-ai-project/docs/uml/UML_ai-threat-detection-components.png) | Component | Multi-Agent AI Engine: Transaction Analyzer, Behavioral Profiler, Compliance Agent, Gemini AI Copilot, 32-feature Store, Model Registry & Retraining Loop |
| 4 | **Entity Relationship Diagram (ERD)** | [`UML_entity-relationship-diagram.png`](file:///home/ngoctan/Downloads/blockchain-ai-project/docs/uml/UML_entity-relationship-diagram.png) | Class / ERD | 26 SQLAlchemy entities: Organizations, Users, Wallets, Monthly Partitioned Transactions, TokenTransfers, RiskAssessments, Blacklists, Alerts, Cases, Policies |
| 5 | **14-Container Deployment Topology** | [`UML_deployment-diagram.png`](file:///home/ngoctan/Downloads/blockchain-ai-project/docs/uml/UML_deployment-diagram.png) | Deployment | Docker Compose network topology: Ingress Gateway, 7 Node.js services, FastAPI, Scanner, RabbitMQ cluster, PostgreSQL volume, Prometheus & Grafana |
| 6 | **Overall System Use Case** | [`UML_usecase-overall.png`](file:///home/ngoctan/Downloads/blockchain-ai-project/docs/uml/UML_usecase-overall.png) | Use Case | 4 human actors (Security Analyst, Compliance Officer, Admin, DeFi Client) + 2 autonomous actors (Chain Scanner, AI Agent) |
| 7 | **Frontend Client Architecture** | [`UML_frontend-architecture.png`](file:///home/ngoctan/Downloads/blockchain-ai-project/docs/uml/UML_frontend-architecture.png) | Component | Next.js 14 SOC Dashboard, Real-time Socket.IO subscriptions, Recharts threat telemetry visualizer, Case dossier room, Axios API client |
| 8 | **Sequence: Real-Time Threat Detection** | [`UML_seq-realtime-threat-scan.png`](file:///home/ngoctan/Downloads/blockchain-ai-project/docs/uml/UML_seq-realtime-threat-scan.png) | Sequence | Alchemy block query, RabbitMQ message stream, AI ML risk scoring, Alert persistence, Real-time WebSocket alarm push to analyst |
| 9 | **Sequence: Case Investigation & Gemini** | [`UML_seq-transaction-investigation.png`](file:///home/ngoctan/Downloads/blockchain-ai-project/docs/uml/UML_seq-transaction-investigation.png) | Sequence | Analyst creates Case, queries Gemini Copilot in natural language, receives money flow snapshot, closes case with permanent blacklist |
| 10 | **Sequence: Compliance AML Screening** | [`UML_seq-compliance-aml-screening.png`](file:///home/ngoctan/Downloads/blockchain-ai-project/docs/uml/UML_seq-compliance-aml-screening.png) | Sequence | Pre-flight crypto transfer screening, OFAC blacklist validation, automated transaction interception and holding for compliance review |
| 11 | **Sequence: API Gateway Circuit Breaker** | [`UML_seq-auth-gateway-proxy.png`](file:///home/ngoctan/Downloads/blockchain-ai-project/docs/uml/UML_seq-auth-gateway-proxy.png) | Sequence | Gateway JWT authentication, Redis rate limiting (200/15min), `x-correlation-id` injection, Opossum Circuit Breaker failover |
| 12 | **State Machine: Transaction Risk** | [`UML_state-transaction-risk-lifecycle.png`](file:///home/ngoctan/Downloads/blockchain-ai-project/docs/uml/UML_state-transaction-risk-lifecycle.png) | State Machine | `PENDING_ANALYSIS` → `LOW_RISK` / `MEDIUM_RISK` / `HIGH_RISK_FLAGGED` / `CRITICAL_EXPLOIT` → `UNDER_INVESTIGATION` → `RESOLVED_CLEARED` / `BLACKLISTED_CONFIRMED` |
| 13 | **State Machine: Security Alert Incident** | [`UML_state-alert-incident-lifecycle.png`](file:///home/ngoctan/Downloads/blockchain-ai-project/docs/uml/UML_state-alert-incident-lifecycle.png) | State Machine | `NEW` → `ACKNOWLEDGED` → `INVESTIGATING` → `ESCALATED` → `CLOSED_CONFIRMED` / `CLOSED_FALSE_POSITIVE` |
| 14 | **Activity: Continuous Ingestion Pipeline** | [`UML_activity-scanner-ai-detection.png`](file:///home/ngoctan/Downloads/blockchain-ai-project/docs/uml/UML_activity-scanner-ai-detection.png) | Activity / Flow | Alchemy RPC polling → Block parsing → 32-feature vector generation → ML inference → Alert dispatch & Monthly partitioned table insertion |
| 15 | **Sequence: Human-in-the-Loop Model Retraining** | [`UML_seq-model-retraining-feedback.png`](file:///home/ngoctan/Downloads/blockchain-ai-project/docs/uml/UML_seq-model-retraining-feedback.png) | Sequence | Analyst feedback label logging, daily dataset aggregation, offline candidate model retraining, F1-score evaluation vs baseline, zero-downtime hot-swap |
| 16 | **Sequence: Gateway Circuit Breaker & RabbitMQ DLQ** | [`UML_seq-circuit-breaker-dlq.png`](file:///home/ngoctan/Downloads/blockchain-ai-project/docs/uml/UML_seq-circuit-breaker-dlq.png) | Sequence | Opossum circuit breaker trip, fallback execution, and RabbitMQ Dead Letter Queue (DLQ) unprocessable message capture & exponential backoff retry |
| 17 | **State Machine: Security Case Investigation** | [`UML_state-case-investigation.png`](file:///home/ngoctan/Downloads/blockchain-ai-project/docs/uml/UML_state-case-investigation.png) | State Machine | `OPEN` → `EVIDENCE_COLLECTING` → `COPILOT_ANALYSIS` → `ESCALATED_AML` → `CLOSED_BLACKLISTED` / `CLOSED_CLEARED` |
| 18 | **Specialized Multi-Agent Threat Sentinel** | [`UML_component-multi-agent-sentinel.png`](file:///home/ngoctan/Downloads/blockchain-ai-project/docs/uml/UML_component-multi-agent-sentinel.png) | Component | Money Laundering Agent (AML), Wash Trading Agent, Scam & Honeypot Agent with Blacklist Override to score 99 |
| 19 | **Activity: Monthly Partitioning Maintenance** | [`UML_activity-partition-maintenance.png`](file:///home/ngoctan/Downloads/blockchain-ai-project/docs/uml/UML_activity-partition-maintenance.png) | Activity / Flow | PostgreSQL dynamic `tx_YYYY_MM` table partition auto-provisioning, query pruning optimization, and cold Parquet archival |
| 20 | **Sequence: System Health Diagnostics** | [`UML_seq-system-health-diagnostics.png`](file:///home/ngoctan/Downloads/blockchain-ai-project/docs/uml/UML_seq-system-health-diagnostics.png) | Sequence | System Admin `/admin/diagnostics/status` monitoring, p95 latency tracking, RabbitMQ queue depth check, Slack Webhook alerts |

---

## 🛠️ Prerequisites & Rendering Instructions

### Dependencies
- **Java Runtime Environment**: OpenJDK 17+ (installed at `/usr/bin/java`)
- **PlantUML**: Version 2.18+ (`plantuml.jar`)
- **Layout Engine**: Smetana (pure Java Graphviz-compatible layout engine)

### Command Line Rendering
To regenerate all diagrams from `UML_Diagrams.puml`:

```bash
cd /home/ngoctan/Downloads/blockchain-ai-project/docs/uml

# Render all diagrams to PNG
java -Djava.awt.headless=true -DPLANTUML_LIMIT_SIZE=16384 -jar /home/ngoctan/.antigravity-ide/extensions/jebbs.plantuml-2.18.1/plantuml.jar -P"layout=smetana" UML_Diagrams.puml

# Create UML_ prefixed copies
for f in *.png; do cp "$f" "UML_$f"; done
```

---

## 🏛️ Architectural Context & Domain Design

### 1. 14-Container Microservices Architecture & Resilience
- **API Gateway (Port 8001)**: Single entry point handling client authentication, rate limiting, request tracing via `x-correlation-id`, and Opossum Circuit Breakers to prevent cascading failures.
- **Microservices Stack (Ports 3001–3007)**: Auth, Wallet, Alert, Transfer, Analytics, Compliance, and Event (WebSocket) services completely decoupled.
- **Asynchronous Event Mesh**: RabbitMQ topic exchanges (`blockchain.events`, `threat.alert`) ensure high throughput with Dead Letter Queues (DLQ) for guaranteed delivery.

### 2. Multi-Agent AI Sentinel & Gemini Copilot
- **Multi-Agent Evaluation**:
  - `Transaction Analyzer Agent`: Gas price anomaly, flash loan patterns, Tornado Cash mixer interaction.
  - `Behavioral Profiler Agent`: Historical wallet velocity and dormant cluster wakeups.
  - `Compliance Agent`: OFAC sanctions list and phishing databases.
- **Generative AI Copilot**: Google Gemini engine providing natural language incident summaries and interactive token transit graphs.
- **Continuous Learning Loop**: Feedback labels provided by human SOC analysts automatically retrain the active classifier models.

### 3. High-Performance Partitioned Database (PostgreSQL 16)
- The core `transactions` table is partitioned monthly (e.g. `tx_2026_01`, `tx_2026_02`) to maintain low index depth and sub-millisecond query latencies across millions of historical on-chain transactions.
