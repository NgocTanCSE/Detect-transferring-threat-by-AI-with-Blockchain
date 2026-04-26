# Blockchain AI Sentinel - System Components

## 1. Core Architecture
The system is designed as a high-performance, unified platform optimized for Hugging Face Spaces deployment. It consists of two main layers:
- **Frontend (Next.js)**: A premium, glassmorphic dashboard built with React and Tailwind CSS.
- **Backend (FastAPI)**: A high-concurrency Python API handling blockchain logic, AI analysis, and persistent reporting.

## 2. Key Components
### A. AI Detection Engine
- **Multi-Agent System**: Utilizes specialized agents to detect Money Laundering (AML), Market Manipulation, and Scams.
- **Risk Scoring**: Real-time analysis of transaction patterns, historical behavior, and counterparty risk scores from 0 to 100.
- **Natural Language Assistant**: A built-in dashboard assistant (this chatbot) that provides insights and explains system metrics.

### B. Role-Based Access Control (RBAC)
The dashboard adapts its UI and features to four specialized roles:
- **System Admin**: Monitors node health, endpoint availability, latency (p95), and system diagnostics logs.
- **AI Data Engineer**: Manages model registry, feature stores, deployment posture, and pipeline metrics.
- **Security Analyst**: Investigates the alert queue, manages high-risk cases, and reviews AI-detected threat logs.
- **Compliance Manager**: Reviews automated policy rules, audit trails, and regulatory KPI reports.

### C. Persistent Reporting Layer
- **Snapshot Logic**: The system automatically captures snapshots of Money Flow, Compliance KPIs, and System Health.
- **Reporting Dashboard**: Provides 30-day summaries of blocked value, alert volume, and control effectiveness.
- **Audit Completeness**: Automatically tracks missing evidence trails and control ownership gaps.

### D. Data Management
- **Database**: Uses SQLite for zero-config local development and Hugging Face deployment, or PostgreSQL for high-scale production.
- **ORM**: SQLAlchemy handles all database interactions.
- **Seeding Engine**: The `seed_wallets.py` script populates the system with realistic historical data, including thousands of transactions and AI logs.

### E. Frontend Technologies
- **Framework**: Next.js 14 with App Router and Lucide Icons.
- **Visualization**: Recharts for interactive, role-specific data visualization (Line, Bar, Pie charts).
- **UI Design**: Modern "Glassmorphism" theme using Tailwind CSS, featuring semi-transparent panels and vibrant, role-based color palettes.

## 3. Workflow
1. **Ingest**: Blockchain transactions are monitored (or simulated).
2. **Analyze**: The AI Engine evaluates each transaction for risk.
3. **Flag**: Suspicious activity triggers alerts and is logged in the threat logs.
4. **Report**: Data is aggregated into snapshots for the Compliance and Admin dashboards.
