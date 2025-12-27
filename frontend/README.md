# Blockchain AI Security Frontend

A Next.js 14 application with a Cyberpunk/Dark Mode theme for the Blockchain AI Security system.

## Features

- **Landing Page** (`/`): Two main entry points - User Demo and Admin System
- **Admin Dashboard** (`/admin/dashboard`): AI detection module cards, suspicious accounts table with status controls
- **Admin Tracking** (`/admin/tracking`): Monitor flagged wallets with network connection visualization
- **Admin History** (`/admin/history`): Blocked transfers history and money flow charts
- **User Exchange** (`/user/exchange`): Banking-style wallet UI with protected transfers and 3-strike warning system

## Tech Stack

- **Next.js 14** - App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling with custom Cyberpunk theme
- **Shadcn UI** - UI Components
- **Recharts** - Charts and graphs
- **Lucide React** - Icons
- **TanStack Query** - Data fetching and caching

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Backend Connection

The frontend is configured to proxy API requests to `http://localhost:8000`. Make sure the backend is running before using the application.

```bash
# Start backend (from project root)
docker-compose up -d
```

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   ├── dashboard/page.tsx    # AI detection dashboard
│   │   │   ├── tracking/page.tsx     # Wallet monitoring
│   │   │   ├── history/page.tsx      # Blocked transfers
│   │   │   └── layout.tsx            # Admin sidebar layout
│   │   ├── user/
│   │   │   ├── exchange/page.tsx     # User wallet & transfer
│   │   │   └── layout.tsx            # User header layout
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Landing page
│   │   ├── providers.tsx             # React Query provider
│   │   └── globals.css               # Global styles & theme
│   ├── components/
│   │   └── ui/                       # Shadcn UI components
│   └── lib/
│       ├── api.ts                    # API functions & types
│       └── utils.ts                  # Utility functions
├── tailwind.config.ts                # Tailwind + Cyberpunk theme
├── next.config.mjs                   # Next.js config with API proxy
└── package.json
```

## Theme Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Neon Cyan | `#00f0ff` | Primary accent, success states |
| Neon Red | `#ff0040` | Alerts, high risk, blocked |
| Neon Orange | `#ff6600` | Warnings, medium risk |
| Neon Green | `#00ff88` | Success, low risk, active status |
| Neon Purple | `#8b5cf6` | Secondary accent |
| Background Dark | `#0a0a0f` | Main background |
| Card Background | `#0f0f1a` | Card surfaces |

## API Endpoints Used

| Endpoint | Description |
|----------|-------------|
| `GET /statistics/dashboard` | Dashboard stats for AI modules |
| `GET /wallets` | List wallets with filters |
| `PUT /wallets/{address}/status` | Update wallet status |
| `GET /wallets/{address}/connections` | Get wallet network connections |
| `GET /blocked-transfers` | Blocked transfer history |
| `GET /statistics/flow` | Money flow data for charts |
| `GET /wallet/{address}/balance` | Wallet balance |
| `GET /wallet/{address}/transactions` | Transaction history |
| `POST /transfer/protected` | Protected transfer with risk check |
| `GET /alerts/latest` | Latest security alerts |
