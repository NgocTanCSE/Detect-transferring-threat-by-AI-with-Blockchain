# Smoke Tests - Multi-Chain Feature (Phase 3)

## Overview
Comprehensive smoke tests validating multi-chain support across dashboard, exchange, alerts, and WebSocket endpoints.

## Test Environment
- **Docker Compose**: All 5 services running (db, backend, scanner, backend-node, frontend)
- **Base URLs**:
  - Backend: `http://localhost:8000`
  - Node Orchestrator: `http://localhost:8001`
  - Frontend: `http://localhost:3000`
- **Database**: PostgreSQL with both ethereum and bsc wallets seeded

---

## Test Suite 1: Backend Endpoint Chain Filtering

### T1.1: Dashboard Statistics - Default Chain
**Endpoint:** `GET /statistics/dashboard`
**Expected:** Returns ethereum data (default chain)
**Steps:**
```bash
curl -s http://localhost:8000/statistics/dashboard | jq '.wallet_count, .alert_count'
```
**Pass Criteria:**
- Status 200 ✅
- Returns numeric wallet_count > 0
- Returns numeric alert_count > 0

---

### T1.2: Dashboard Statistics - BSC Chain
**Endpoint:** `GET /statistics/dashboard?chain=bsc`
**Expected:** Returns bsc data
**Steps:**
```bash
curl -s http://localhost:8000/statistics/dashboard?chain=bsc | jq '.wallet_count, .alert_count'
```
**Pass Criteria:**
- Status 200 ✅
- Returns numeric values (may be 0 if no BSC-specific alerts seeded yet)
- No AttributeError

---

### T1.3: Dashboard Statistics - Invalid Chain
**Endpoint:** `GET /statistics/dashboard?chain=invalid`
**Expected:** Returns 400 validation error
**Steps:**
```bash
curl -s http://localhost:8000/statistics/dashboard?chain=invalid -w "\nStatus: %{http_code}\n"
```
**Pass Criteria:**
- Status 400 ✅
- Error message contains "Invalid chain"

---

### T1.4: Alerts Endpoint - Ethereum
**Endpoint:** `GET /alerts/recent?chain=ethereum&limit=5`
**Expected:** Returns recent ethereum alerts
**Steps:**
```bash
curl -s "http://localhost:8000/alerts/recent?chain=ethereum&limit=5" | jq '.[] | {chain_id, severity}'
```
**Pass Criteria:**
- Status 200 ✅
- All returned alerts have chain_id = "ethereum"
- Returns up to 5 alerts

---

### T1.5: Alerts Endpoint - BSC
**Endpoint:** `GET /alerts/recent?chain=bsc&limit=5`
**Expected:** Returns recent bsc alerts (if any)
**Steps:**
```bash
curl -s "http://localhost:8000/alerts/recent?chain=bsc&limit=5" | jq '.[] | {chain_id}'
```
**Pass Criteria:**
- Status 200 ✅
- If alerts exist: all have chain_id = "bsc"
- No 500 errors

---

### T1.6: Blocked Transfers - Ethereum
**Endpoint:** `GET /blocked-transfers?chain=ethereum&limit=3`
**Expected:** Returns ethereum blocked transfers
**Steps:**
```bash
curl -s "http://localhost:8000/blocked-transfers?chain=ethereum&limit=3" | jq '.[] | {chain_id, transfer_id}'
```
**Pass Criteria:**
- Status 200 ✅
- All returned transfers have chain_id = "ethereum"

---

### T1.7: Flow Statistics - Ethereum
**Endpoint:** `GET /statistics/flow?chain=ethereum&days=7`
**Expected:** Returns ethereum flow for last 7 days
**Steps:**
```bash
curl -s "http://localhost:8000/statistics/flow?chain=ethereum&days=7" | jq '.total_inflow, .total_outflow'
```
**Pass Criteria:**
- Status 200 ✅
- Returns numeric values
- No chain-related errors

---

## Test Suite 2: Frontend Chain Selector

### T2.1: Exchange Page Loads
**Step:** Navigate to `http://localhost:3000/user/exchange` (after login)
**Expected:** Page displays with chain selector dropdown
**Pass Criteria:**
- Page loads (no 404)
- Chain selector dropdown visible
- Default chain shows "Ethereum"
- Default asset shows "ETH"

---

### T2.2: Chain Selector - Switch to BSC
**Step:**
1. Load exchange page
2. Open chain dropdown
3. Select "BSC"
**Expected:**
- Asset automatically changes to "BNB"
- All labels update (Send BNB, Balance in BNB, etc.)
**Pass Criteria:**
- selectedChain state = "bsc" ✅
- selectedAsset state = "BNB" ✅
- All labels reflect new asset

---

### T2.3: Chain Selector - Switch Back to Ethereum
**Step:**
1. From BSC, open chain dropdown
2. Select "Ethereum"
**Expected:**
- Asset changes back to "ETH"
- All labels update
**Pass Criteria:**
- selectedChain state = "ethereum" ✅
- selectedAsset state = "ETH" ✅

---

### T2.4: Transfer API Payload
**Step:**
1. Open DevTools Network tab
2. Attempt transfer (don't submit)
3. Check request payload
**Expected:** Payload includes both chain and asset fields
```json
{
  "chain": "ethereum",
  "asset": "ETH",
  "amount": 1.0,
  "from_wallet_id": "...",
  "to_wallet_id": "...",
  "confirm_risk": false
}
```
**Pass Criteria:**
- chain field present ✅
- asset field present ✅
- Both set to correct values for selected chain ✅

---

## Test Suite 3: WebSocket Real-Time Alerts

### T3.1: WebSocket Connection
**Step:**
1. Open browser console at dashboard
2. Look for connection log
**Expected:** Console shows "Connected to Real-time Sentinel Node"
**Pass Criteria:**
- Connection established ✅
- Socket ID logged ✅

---

### T3.2: WebSocket Alert Notification
**Step:**
1. Backend receives high-risk alert (risk_score ≥ 80, severity = CRITICAL)
2. Monitor WebSocket events
**Expected:** new-threat event includes chain context
```json
{
  "address": "0x...",
  "score": 85,
  "level": "CRITICAL",
  "chain": "ethereum",
  "message": "...",
  "timestamp": "2026-04-25T..."
}
```
**Pass Criteria:**
- chain field present ✅
- Notification displays: "Critical threat detected on {chain}: {address}" ✅

---

### T3.3: WebSocket Alert - BSC Chain
**Step:** Same as T3.2 but for BSC transaction
**Expected:** Chain field in alert = "bsc"
**Pass Criteria:**
- chain = "bsc" ✅
- Notification mentions "bsc" ✅

---

## Test Suite 4: Data Consistency

### T4.1: Database Schema Validation
**Step:** Connect to PostgreSQL and check schema
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name IN ('wallets', 'transactions', 'alerts', 'blocked_transfers')
  AND column_name = 'chain_id'
ORDER BY table_name;
```
**Expected:** All 4 tables have chain_id column
**Pass Criteria:**
- wallets.chain_id exists ✅
- transactions.chain_id exists ✅
- alerts.chain_id exists ✅
- blocked_transfers.chain_id exists ✅

---

### T4.2: Seed Data - Multi-Chain Wallets
**Step:** Query database
```sql
SELECT DISTINCT chain_id, COUNT(*) as wallet_count
FROM wallets
GROUP BY chain_id;
```
**Expected:** Both ethereum and bsc wallets exist
**Pass Criteria:**
- ethereum wallets count > 0 ✅
- bsc wallets count > 0 ✅
- No NULL chain_id values ✅

---

### T4.3: API Response Consistency
**Step:** Query same endpoints for both chains
```bash
curl -s http://localhost:8000/alerts/recent?chain=ethereum | jq '.[0].chain_id'
curl -s http://localhost:8000/alerts/recent?chain=bsc | jq '.[0].chain_id'
```
**Expected:**
- Ethereum query returns "ethereum"
- BSC query returns "bsc"
**Pass Criteria:**
- No cross-contamination (ethereum data in bsc response)
- All filtered results match requested chain ✅

---

## Test Execution Checklist

### Prerequisites
- [ ] Docker Compose running all 5 services
- [ ] Backend healthy (`curl http://localhost:8000/`)
- [ ] Frontend healthy (`curl http://localhost:3000/`)
- [ ] Node orchestrator healthy (`curl http://localhost:8001/health`)
- [ ] Database migrations completed (check logs for "schema fix")

### Test Execution
- [ ] Test Suite 1: Backend Endpoints (7 tests, ~5 min)
- [ ] Test Suite 2: Frontend Chain Selector (4 tests, ~10 min)
- [ ] Test Suite 3: WebSocket Events (3 tests, ~5 min)
- [ ] Test Suite 4: Data Consistency (3 tests, ~3 min)

### Pass/Fail Criteria
- **PASS**: All 17 tests pass
- **FAIL**: Any test fails → see Rollback section

### Sign-off
- [ ] All tests executed
- [ ] All tests passed
- [ ] Date: ____________
- [ ] Tester: ___________

---

## Rollback Procedure

See [ROLLBACK.md](ROLLBACK.md) for detailed rollback instructions if any test fails.
