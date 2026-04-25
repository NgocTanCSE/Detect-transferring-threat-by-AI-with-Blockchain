---
title: Blockchain AI Threat Detector
emoji: 🛡️
colorFrom: blue
colorTo: gray
sdk: docker
pinned: false
---

# 🛡️ Blockchain AI Security | Anti-Fraud Detection System

> Multi-agent AI system for real-time blockchain fraud detection across **Ethereum & BSC** with Cyberpunk-themed admin dashboard

## 🌐 Multi-Chain Support

✅ **Ethereum** (ETH) - Full support
✅ **Binance Smart Chain** (BNB) - Full support
⏳ **Polygon, Avalanche** - Coming soon

**Features:**
- Dashboard filtering by chain
- Multi-asset exchange transfers (ETH ↔ BNB)
- Real-time WebSocket alerts with chain context
- Database isolation with chain_id indexing
- Backward compatible API (v1/v2)

See [docs/CHAIN_ASSET_MATRIX.md](./docs/CHAIN_ASSET_MATRIX.md) for details.

---

## 🚀 Tech Stack

### Backend
- **FastAPI** - High-performance Python web framework
- **PostgreSQL 16** - Production database with partitioning
- **Alchemy API** - Ethereum blockchain data provider
- **SQLAlchemy** - Database ORM
- **Multi-Agent AI** - Specialized fraud detection engines

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS with custom Cyberpunk theme
- **Shadcn UI** - Customizable component library
- **TanStack Query** - Data fetching and caching
- **Recharts** - Data visualization

### Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration

---

## 📋 Prerequisites

- **Docker Desktop** installed
- **Git** installed
- **Alchemy API Key** (free at [alchemy.com](https://www.alchemy.com/))

---

## 🔧 Installation & Setup

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd blockchain-ai-project
```

### 2. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your Alchemy API key
# ALCHEMY_API_KEY=your_actual_api_key_here
```

### 3. Start Application
```bash
# Build and start all services
docker-compose up -d --build

# Check service status
docker ps
```

### 4. Access Application
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

### Hugging Face single-space deployment
Use the root `Dockerfile` to run the frontend, backend, and scanner in one Hugging Face Space.

Required env vars:
- `DATABASE_URL` pointing to Supabase with `sslmode=require`
- `ALCHEMY_API_KEY`
- `JWT_SECRET_KEY`
- `AUTH_DISABLED=false`

DB mode on HF:
- If `DATABASE_URL` is Postgres, runtime uses remote DB (Supabase).
- If `DATABASE_URL` is not set, runtime falls back to SQLite at `/data/blockchain_local.db`.

The frontend proxies `/api` requests to the backend inside the same container, so one Space is enough.

On startup in Postgres mode, the Space can bootstrap an empty database from `database/init.sql` and `database/seed_rich_demo.sql`.

---

## 🏗️ Project Structure

```
blockchain-ai-project/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── main.py         # API endpoints
│   │   ├── core/           # Config & database
│   │   ├── models/         # SQLAlchemy models
│   │   └── services/       # AI engines & services
│   ├── blockchain_client.py
│   ├── scanner.py          # Background blockchain scanner
│   ├── train_model.py
│   └── requirements.txt
│
├── frontend/               # Next.js frontend
│   ├── src/
│   │   ├── app/           # App Router pages
│   │   │   ├── page.tsx   # Landing page
│   │   │   ├── admin/     # Admin dashboard
│   │   │   └── user/      # User interface
│   │   ├── components/    # Reusable UI components
│   │   └── lib/          # API & utilities
│   ├── public/
│   └── package.json
│
├── database/              # Database initialization
│   ├── init.sql          # Schema & sample data
│   └── migrate_*.sql     # Migration scripts
│
├── docker-compose.yml    # Service orchestration
├── .env.example         # Environment template
└── .gitignore          # Git ignore rules
```

---

## 📚 Documentation

Complete technical documentation is available in the [**docs/**](./docs) folder:

### Quick Links
- **[docs/INDEX.md](./docs/INDEX.md)** - Documentation index & navigation
- **[docs/PHASE_2_SUMMARY.md](./docs/PHASE_2_SUMMARY.md)** - Multi-chain implementation overview
- **[docs/SMOKE_TESTS.md](./docs/SMOKE_TESTS.md)** - Testing procedures
- **[docs/DEPLOY_HF_FINAL.md](./docs/DEPLOY_HF_FINAL.md)** - Deployment guide
- **[docs/CHAIN_ASSET_MATRIX.md](./docs/CHAIN_ASSET_MATRIX.md)** - Chain/asset architecture
- **[docs/ROLLBACK.md](./docs/ROLLBACK.md)** - Emergency procedures

### All Documentation
See [docs/INDEX.md](./docs/INDEX.md) for complete documentation index with 12+ reference documents.

---

## 🎯 Features

### 🤖 AI Detection Modules
1. **Money Laundering Detection**
   - Layering pattern analysis
   - Structuring detection
   - Rapid movement tracking

2. **Market Manipulation Detection**
   - Wash trading
   - Pump & dump schemes
   - Spoofing patterns

3. **Scam Detection**
   - Phishing attempts
   - Rug pulls
   - Known blacklist matching

### 🎨 User Interface
- **Landing Page**: User Demo & Admin System entry
- **Admin Dashboard**: 4 AI module cards, suspicious accounts table
- **Admin Tracking**: Wallet monitoring with network visualization
- **Admin History**: Blocked transfers & flow charts
- **User Exchange**: Banking-style UI with 3-strike warning system

---

## 🧭 Chuc Nang He Thong (Tu Co Ban Den Nang Cao)

### 1) Nhom chuc nang co ban
- **Xac thuc va phan quyen**: dang ky, dang nhap, route protection, role-based access.
- **Tong quan du lieu**: hien thi chi so tong so vi, tong canh bao, critical alerts, blocked transfers.
- **Theo doi giao dich/vi**: tra cuu vi, lich su giao dich, canh bao gan voi vi.

### 2) Nhom chuc nang nghiep vu theo role
- **System Admin**:
   - Theo doi node endpoints, pipeline metrics, SLO metrics.
   - Quan ly diagnostics logs: filter, export CSV, archive/unarchive.
   - Kiem tra data integrity va auto-fix control bi thieu.
- **AI Data Engineer**:
   - Quan ly feature store (feature key, expression, enablement).
   - Quan ly model registry (version, active model, promoted metadata).
   - Theo doi do san sang cua du lieu phuc vu AI suy luan rui ro.
- **Security Analyst**:
   - Alert queue, case queue, case actions.
   - Theo doi notifications va blocked transfers.
   - Uu tien xu ly case theo muc do rui ro.
- **Compliance Risk Manager**:
   - Policy state, audit state, policy actions.
   - Reporting summary, audit completeness, audit gaps.
   - Theo doi do day du bang chung va hieu qua kiem soat.

### 3) Nhom chuc nang nang cao
- **DB-first diagnostics**: log van hanh duoc luu ben vung trong DB, phuc vu audit va truy vet.
- **Data integrity automation**:
   - `GET /ops/system/data-integrity`
   - `GET /ops/system/data-integrity/export?format=csv|json`
   - `POST /ops/system/data-integrity/auto-fix`
- **Assistant van hanh theo ngu canh**:
   - Chat theo scope dashboard/wallet/case/policy/tracking.
   - Su dung Gemini API key (AI Studio).
   - Co co che quality guard de tranh cau tra loi qua ngan/lech format.
- **Live refresh UX**:
   - Tu dong refresh khi doi tab/chuc nang.
   - Polling dinh ky va refresh khi quay lai tab/window.

---

## ⚖️ Uu Diem Va Nhuoc Diem

### Uu diem
- **Phan vai tro ro rang**: giao dien va nghiep vu tach theo 4 role van hanh.
- **DB-first**: diagnostics/audit duoc luu ben vung, de truy vet va bao cao.
- **Tinh van hanh cao**: co export, archive/unarchive, integrity checks, auto-fix.
- **Trien khai linh hoat**: co the chay 1 Hugging Face Space cho toan bo app.
- **Tro ly AI theo ngu canh**: giup giai thich chi so va de xuat hanh dong nhanh.

### Nhuoc diem
- **Dashboard component lon**: logic tap trung nhieu o mot file, kho mo rong ve sau.
- **Do tre du lieu**: hien dang polling, chua phai realtime push (WebSocket/SSE).
- **Phu thuoc chat luong data seed**: du lieu ngheo se lam giam do sau cua phan tich.
- **Phu thuoc runtime HF**: Space free co the sleep/cold start anh huong trai nghiem.
- **Chat luong AI bien dong**: da co guard/fallback nhung van can tiep tuc fine-tune prompt.

---

## 🔐 Security Notes

### ⚠️ NEVER COMMIT THESE FILES:
- `.env` - Contains API keys and credentials
- `wallet.json` - Private keys
- `*.keystore` - Wallet keystores
- `database backups` - May contain sensitive data

### 🛡️ Protected by .gitignore:
- Environment variables
- Docker volumes
- Database dumps
- API keys/secrets
- Node modules
- Python cache
- Build artifacts

---

## 🐳 Docker Services

| Service | Port | Description |
|---------|------|-------------|
| `frontend` | 3000 | Next.js UI |
| `backend` | 8000 | FastAPI server |
| `scanner` | - | Background blockchain scanner |
| `db` | 5432 | PostgreSQL database |

### Useful Commands
```bash
# View logs
docker-compose logs -f [service_name]

# Restart specific service
docker-compose restart [service_name]

# Stop all services
docker-compose down

# Remove volumes (fresh database)
docker-compose down -v

# Rebuild and restart
docker-compose up -d --build
```

---

## 📊 Database

### Initialize/Reset Database
```bash
# Stop services and remove volumes
docker-compose down -v

# Start fresh (will run init.sql automatically)
docker-compose up -d
```

### Access Database
```bash
docker exec -it blockchain_db psql -U user -d blockchain_db
```

### Sample Queries
```sql
-- View all wallets
SELECT * FROM wallets LIMIT 10;

-- High-risk wallets
SELECT * FROM wallets WHERE risk_score >= 90;

-- Recent alerts
SELECT * FROM alerts ORDER BY detected_at DESC LIMIT 20;
```

---

## 🧪 API Endpoints

### Statistics
- `GET /statistics/dashboard` - Dashboard overview
- `GET /statistics/flow` - Money flow analysis

### Wallets
- `GET /wallets` - List wallets (with filters)
- `GET /wallets/{address}/connections` - Network connections
- `PUT /wallets/{address}/status` - Update wallet status

### Transfers
- `POST /transfer/protected` - Protected transfer with AI check
- `GET /blocked-transfers` - Blocked transfer history

### Alerts
- `GET /alerts/latest` - Latest alerts
- `GET /alerts/recent` - Recent alerts with stats

---

## 🎨 Theming

Frontend uses custom **Cyberpunk/Dark Mode** theme with neon colors:
- **Cyan** (#00f0ff) - Primary accent
- **Red** (#ff0040) - Danger/Critical
- **Orange** (#ff6600) - Warning
- **Green** (#00ff88) - Success
- **Purple** (#8b5cf6) - Info

Custom animations:
- `glow-pulse` - Pulsing neon glow
- `border-glow` - Animated border
- `float` - Floating animation

---

## 🐛 Troubleshooting

### Frontend can't connect to backend
```bash
# Check all services are running
docker ps

# Check frontend logs
docker logs blockchain_frontend

# Ensure BACKEND_URL is correct in .env
BACKEND_URL=http://backend:8000
```

### Database initialization failed
```bash
# Check database logs
docker logs blockchain_db

# Remove volume and restart
docker-compose down -v
docker-compose up -d
```

### Port already in use
```bash
# Change ports in docker-compose.yml
ports:
  - "3001:3000"  # Use 3001 instead of 3000
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📝 License

This project is for educational purposes.

---

## 👨‍💻 Development

### Backend Development
```bash
# Install dependencies locally (optional)
cd backend
pip install -r requirements.txt

# Run backend directly (without Docker)
uvicorn app.main:app --reload
```

### Frontend Development
```bash
# Install dependencies
cd frontend
npm install

# Run dev server
npm run dev
```

### Database Migrations
```bash
# Create new migration
# Edit database/migrate_*.sql

# Apply migration
docker exec blockchain_db psql -U user -d blockchain_db -f /docker-entrypoint-initdb.d/migrate_*.sql
```

---

## 📧 Support

For issues or questions, please open an issue on GitHub.

---

**⚡ Built with Next.js 14, FastAPI, PostgreSQL, and Docker**
