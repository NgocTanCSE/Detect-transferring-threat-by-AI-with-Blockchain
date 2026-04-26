---
title: Blockchain AI Sentinel
emoji: 🛡️
colorFrom: blue
colorTo: red
sdk: docker
pinned: false
---

# Blockchain AI Sentinel - Microservices Edition 🚀

A state-of-the-art, fully decoupled microservices platform for real-time blockchain threat detection, risk management, and AI-driven compliance.

## 🏗️ Architecture Overview

The system has been migrated from a monolithic architecture to a robust, 14-container microservices stack.

```mermaid
graph TB
  subgraph "Frontend Layer"
    UI["Frontend (Next.js) :3000"]
  end

  subgraph "Gateway Layer"
    GW["API Gateway (Node.js) :8001"]
  end

  subgraph "Microservices Layer"
    Auth["Auth Service :3001"]
    Wallet["Wallet Service :3002"]
    Alert["Alert Service :3003"]
    Transfer["Transfer Service :3004"]
    Analytics["Analytics Service :3005"]
    Compliance["Compliance Service :3006"]
    Event["Event Service :3007"]
    AI["AI Service (Python) :8000"]
    Scanner["Autonomous Scanner"]
  end

  subgraph "Infrastructure Layer"
    PGMain["Postgres Main :5432"]
    PGAlerts["Postgres Alerts :5433"]
    PGTrans["Postgres Transfers :5434"]
    RMQ["RabbitMQ :5672"]
  end

  UI --> GW
  GW --> Auth
  GW --> Wallet
  GW --> Alert
  GW --> Transfer
  GW --> Analytics
  GW --> Compliance
  GW --> Event
  GW --> AI
  
  Auth & Wallet & Compliance & Analytics & Transfer & AI --> PGMain
  Alert --> PGAlerts
  Alert & Event & Transfer & Compliance --> RMQ
  Scanner --> AI & Alert
```

## 🛠️ Key Features

- **Decoupled Architecture**: Each domain logic is isolated in its own service.
- **Centralized API Gateway**: Single entry point with JWT authentication, rate limiting, and observability.
- **Real-time Observability**: request tracing via `x-correlation-id` and structured JSON logging.
- **Event-Driven**: Asynchronous communication via RabbitMQ for high throughput.
- **AI-Powered**: Dedicated Python AI service for deep transaction analysis and risk scoring.
- **Autonomous Scanner**: Background scanner that monitors the chain and flags threats in real-time.

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)

### One-Click Deployment
Simply run the following command in the root directory:
```bash
docker-compose up -d --build
```

### Accessing the System
- **Frontend**: http://localhost:3000
- **API Gateway**: http://localhost:8001
- **RabbitMQ Dashboard**: http://localhost:15672 (admin/admin123)

## 📁 Project Structure

- `/services`: Core microservices (Auth, Wallet, Transfer, etc.)
- `/frontend`: Next.js web application
- `/backend`: Legacy code (Archived)
- `docker-compose.yml`: Root orchestration file

## 🛡️ Security & Observability

- **Security**: Helmet, CORS, and JWT protection on all private routes.
- **Observability**: Every request is assigned a `x-correlation-id` at the Gateway, which is forwarded to all downstream services for end-to-end tracing in logs.

---
© 2026 Blockchain AI Sentinel Team. Managed by Sentinel Prime AI.
