# 🛡️ Blockchain AI Security | Anti-Fraud Detection System

> Multi-agent AI system for real-time Ethereum fraud detection with Cyberpunk-themed admin dashboard

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
