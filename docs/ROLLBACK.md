# Rollback Procedure - Multi-Chain Implementation (Phase 2A-B)

**Last Updated:** April 25, 2026
**Changes Included:** Chain filtering for alerts/blocked-transfers, frontend chain selector, WebSocket chain context
**Git Commit:** (would be documented in production)

---

## Overview

This document provides step-by-step instructions to roll back the multi-chain feature implementation if critical issues are discovered during testing.

**Scope:**
- Backend endpoint chain filtering (alerts, blocked-transfers, dashboard, flow)
- Frontend chain selector UI component
- Database schema migrations (chain_id columns)
- API contract changes (v2 payload structure)

---

## Quick Rollback (Option 1: Docker Restart with Original Schema)

Use this if you need immediate rollback without code changes.

### Steps

1. **Stop all containers**
   ```bash
   cd c:\Users\Ngoc Tan\Downloads\blockchain-ai-project
   docker-compose down -v  # -v removes volumes (fresh schema)
   ```

2. **Restore original compose file** (if modified)
   ```bash
   git checkout docker-compose.yml  # Restore original
   ```

3. **Start with clean database**
   ```bash
   docker-compose up -d
   docker-compose logs -f backend  # Wait for startup (30-40 sec)
   ```

4. **Verify services healthy**
   ```bash
   docker-compose ps
   curl http://localhost:8000/
   curl http://localhost:3000/
   ```

**Result:** All services running with pre-Phase-2A schema and code

**Downtime:** ~45 seconds

---

## Code Rollback (Option 2: Revert Specific Changes)

Use this to selectively roll back specific components while keeping others.

### 2A: Rollback Backend Endpoint Chain Filtering

**Files affected:**
- `backend/app/main.py` - Chain parameters added to 4 endpoints
- `backend/app/core/database.py` - Schema migrations for chain_id
- `backend/app/models/models.py` - chain_id columns added to Alert/BlockedTransfer

**Steps to revert:**

1. **Remove chain parameter from main.py endpoints**

   Remove these from each endpoint:
   - `chain: str = "ethereum"` query parameter
   - `canonical_chain = _normalize_chain_name(chain)` helper call
   - `.filter(Model.chain_id == canonical_chain)` filter

   **Affected endpoints:**
   - `/alerts/recent` (line ~1240)
   - `/blocked-transfers` (line ~2354)
   - `/statistics/dashboard` (line ~2520)
   - `/statistics/flow` (line ~2610)

2. **Restore original filter (no chain filtering)**
   ```python
   # BEFORE (current):
   canonical_chain = _normalize_chain_name(chain)
   alerts = session.query(Alert).filter(Alert.chain_id == canonical_chain)

   # AFTER (rollback):
   alerts = session.query(Alert)  # No chain filter
   ```

3. **Remove schema migration from database.py**

   Delete lines that check/add chain_id columns:
   - Lines checking alerts.chain_id existence
   - Lines checking blocked_transfers.chain_id existence
   - ALTER TABLE statements for both tables
   - UPDATE statements setting defaults
   - CREATE INDEX statements

4. **Restart backend**
   ```bash
   docker-compose restart backend
   docker-compose logs -f backend
   ```

5. **Test endpoints return data without chain param**
   ```bash
   curl http://localhost:8000/statistics/dashboard
   curl http://localhost:8000/alerts/recent?limit=5
   ```

**Expected Result:** All endpoints work without ?chain parameter

---

### 2B: Rollback Frontend Chain Selector

**File affected:**
- `frontend/src/app/user/exchange/page.tsx`

**Steps to revert:**

1. **Remove chain selector state**
   ```typescript
   // REMOVE these lines:
   const [selectedChain, setSelectedChain] = useState("ethereum");
   const [selectedAsset, setSelectedAsset] = useState("ETH");
   ```

2. **Restore hardcoded labels**
   ```typescript
   // BEFORE (current with variables):
   Send {selectedAsset}
   Balance in {selectedAsset}
   Gửi {selectedAsset}

   // AFTER (hardcoded):
   Send ETH
   Balance in ETH (ETH)
   Gửi ETH
   ```

3. **Remove chain selector dropdown**
   ```typescript
   // DELETE the entire <select> element for chain selection
   ```

4. **Restore API call to original signature**
   ```typescript
   // BEFORE (current with chain/asset):
   sendProtectedTransfer(walletId, toAddress, amount, selectedChain, selectedAsset, riskConfirm)

   // AFTER (original, no chain/asset):
   sendProtectedTransfer(walletId, toAddress, amount, "ethereum", "ETH", riskConfirm)
   ```

5. **Restart frontend**
   ```bash
   docker-compose restart frontend
   ```

6. **Test exchange page**
   ```bash
   curl http://localhost:3000/user/exchange
   ```

**Expected Result:** Exchange page shows only ETH transfers, no chain selector

---

### 2C: Rollback API Client Changes

**File affected:**
- `frontend/src/lib/api.ts`

**Steps to revert:**

1. **Restore sendProtectedTransfer() signature**
   ```typescript
   // BEFORE (current):
   export async function sendProtectedTransfer(
     walletId: string,
     toAddress: string,
     amountEth: number,
     chain = "ethereum",
     asset = "ETH",
     confirmRisk = false
   )

   // AFTER (original):
   export async function sendProtectedTransfer(
     walletId: string,
     toAddress: string,
     amountEth: number,
     confirmRisk = false
   )
   ```

2. **Remove chain/asset from request payload**
   ```json
   // BEFORE (current with v2 fields):
   {
     "from_wallet_id": "...",
     "to_wallet_id": "...",
     "to_address": "...",
     "amount": amountEth,
     "amount_eth": amountEth,
     "chain": "ethereum",
     "asset": "ETH",
     "confirm_risk": confirmRisk
   }

   // AFTER (original, only v1 fields):
   {
     "from_wallet_id": "...",
     "to_wallet_id": "...",
     "to_address": "...",
     "amount_eth": amountEth,
     "confirm_risk": confirmRisk
   }
   ```

3. **Rebuild frontend**
   ```bash
   cd frontend
   npm run build
   docker-compose restart frontend
   ```

---

### 2D: Rollback Seed Data

**File affected:**
- `backend/seed_wallets.py`

**Steps to revert:**

1. **Remove BSC wallets from canonical list**
   ```python
   # REMOVE these from canonical_wallets:
   {
     "address": "0xbbb1...bbb",
     "label": "Dave BSC Trader",
     "risk_score": 32.1,
     "risk_category": "normal",
     "tx_count": 15,
     "total_volume_eth": 50.0,
   },
   # ... (Eve BSC Bot and Frank BSC Mixer entries)
   ```

2. **Remove is_bsc_wallet logic**
   ```python
   # REMOVE these lines:
   canonical_index = index % len(canonical_wallets)
   is_bsc_wallet = canonical_index >= 4

   # And change wallet creation to always use ethereum:
   chain_id="ethereum",  # No conditional
   ```

3. **Re-seed database**
   ```bash
   docker-compose exec backend python backend/seed_wallets.py
   docker-compose logs -f backend  # Verify completion
   ```

4. **Verify only ethereum wallets**
   ```bash
   curl http://localhost:8000/statistics/dashboard | jq '.wallet_count'
   ```

**Expected Result:** Database contains only ethereum wallets

---

## Database Schema Rollback (Option 3: Remove Added Columns)

If you want to remove the chain_id columns added to alerts and blocked_transfers:

```sql
-- Connect to PostgreSQL
psql -U postgres -d blockchain_ai

-- Drop columns
ALTER TABLE alerts DROP COLUMN IF EXISTS chain_id;
ALTER TABLE blocked_transfers DROP COLUMN IF EXISTS chain_id;

-- Drop indexes (if they exist)
DROP INDEX IF EXISTS idx_alerts_chain_id;
DROP INDEX IF EXISTS idx_blocked_transfers_chain_id;

-- Verify removal
\d alerts
\d blocked_transfers
```

**Note:** wallets.chain_id and transactions.chain_id should remain (they're core to multi-chain support)

---

## Rollback Verification Checklist

After rollback, verify these endpoints work correctly:

- [ ] `GET /` returns 200 (backend healthy)
- [ ] `GET /statistics/dashboard` returns 200 (no chain param works)
- [ ] `GET /alerts/recent?limit=5` returns 200 (old signature works)
- [ ] `GET /blocked-transfers?limit=3` returns 200
- [ ] `GET /statistics/flow?days=7` returns 200
- [ ] Frontend loads without errors (`GET /` returns HTML)
- [ ] Exchange page shows "Send ETH" (hardcoded asset)
- [ ] No chain selector dropdown visible
- [ ] WebSocket connects (check browser console)
- [ ] Database contains only ethereum wallets

```bash
# Quick verification script
echo "=== Backend Endpoints ===" && \
curl -s http://localhost:8000/ && echo "" && \
curl -s "http://localhost:8000/statistics/dashboard" | jq '.wallet_count' && \
echo "=== Frontend ===" && \
curl -s http://localhost:3000/ | head -1
```

**Pass criteria:** All endpoints return data without errors

---

## Communication After Rollback

If rollback is executed, notify:

1. **Development Team**
   - Issue: (describe what failed)
   - Rollback Time: (when executed)
   - Current Status: (back to pre-Phase-2A)

2. **Testing Team**
   - Multi-chain feature temporarily disabled
   - All wallets filtered to ethereum chain
   - Exchange page shows only ETH transfers

3. **Stakeholders**
   - Multi-chain feature under investigation
   - Timeline for re-deployment TBD

---

## Prevention: Pre-Deployment Checks

Before deploying multi-chain changes in future:

- [ ] All smoke tests pass (SMOKE_TESTS.md)
- [ ] Backend unit tests pass (`pytest backend/`)
- [ ] Frontend build succeeds (`npm run build`)
- [ ] Database migrations run successfully
- [ ] WebSocket events tested in browser console
- [ ] Load test with 100+ concurrent users
- [ ] Backup database before deployment
- [ ] Rollback plan documented (this file)
- [ ] Communication templates prepared

---

## Questions?

For questions about specific rollback steps, refer to:
- [IMPLEMENTATION_PLAN_CHAIN_ASSET.md](IMPLEMENTATION_PLAN_CHAIN_ASSET.md) - Original implementation plan
- [FIX_SUMMARY.md](FIX_SUMMARY.md) - Summary of changes made
- [AUDIT_IMPLEMENTATION_STATUS.md](AUDIT_IMPLEMENTATION_STATUS.md) - What was audited

