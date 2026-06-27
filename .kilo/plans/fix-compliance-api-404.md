# Root Cause Analysis

## Problem Identified in Log
The 404 errors show requests to `/api/ops/compliance/...` endpoints reaching FastAPI (python logs `[no-id] ... - app.main - INFO`) with path `/api/ops/compliance/...` intact, but **FastAPI has no routes with `/api` prefix**.

## Architecture Flow
```
Frontend → Next.js rewrite → API Gateway → Backend Service
```

### Current Request Flow
1. Frontend calls `/api/ops/compliance/policy-rules` (live-dashboard.tsx:308)
2. Next.js rewrites `/api/ops/compliance/policy-rules` → `http://api-gateway:8001/ops/compliance/policy-rules`
3. API Gateway ROUTE_MAP (index.js:291, 311):
   - `/policy-rules` → `compliance` service
   - `/ops/compliance` → `ai` service
4. **Conflict**: `/ops/compliance/policy-rules` matches `/ops/compliance` (longer prefix) → routes to `ai` service
5. **Bug**: No STRIP_PREFIXES defined for `ai` service, so `/ops/compliance` is NOT stripped
6. FastAPI receives `/ops/compliance/policy-rules` but route is defined at `/ops/compliance/policy-rules` - but wait, the log shows `/api/ops/compliance/...`

## Actual Bug: Next.js Rewrite Not Working
The log shows path `/api/ops/compliance/policy-rules` reaching FastAPI, meaning the Next.js rewrite is NOT stripping `/api`. This could be:
- Next.js dev server not loading env vars correctly
- `BACKEND_URL` not set in frontend environment
- `api-gateway` not resolving (container networking issue)

## Secondary Issue: Endpoint Mismatch
The compliance-service (Node.js) has `/policy-rules` and `/reporting/...` endpoints but:
- Frontend calls `/api/ops/compliance/policy-rules` (with `/ops` prefix)
- compliance-service only has `/policy-rules` (without `/ops` prefix)

## Root Causes Summary
1. **Primary**: Next.js rewrite from `/api` to gateway not functioning (requests going directly to FastAPI with `/api` prefix)
2. **Secondary**: API Gateway lacks `/ops/compliance/reporting/*` routes for reporting endpoints (compliance-service has `/reporting/*` but gateway receives `/ops/compliance/reporting/*`)
3. **Tertiary**: `/ops/compliance` routes to `ai` but should consolidate all compliance endpoints to one service

## Solution
The plan must be updated to fix:
1. Ensure Next.js rewrite is working or add explicit `/api/ops/compliance` routes in FastAPI
2. Update API Gateway to route `/ops/compliance/reporting/*` to `ai` service (already routes `/ops/compliance` to `ai`)
3. Add STRIP_PREFIXES for `ai` when receiving `/ops/compliance/*` to strip `/ops/compliance` prefix

## Implementation Steps

### Step 1: Add `/api` prefix routes to FastAPI backend ✓ DONE
In `backend/app/main.py`, added alias routes with `/api` prefix:
- phase2_ops_router, phase3_governance_router, phase4_reporting_router, ai_router all included with `prefix="/api"`

### Step 2: STRIP_PREFIXES not needed
The gateway routes `/ops/compliance/*` to `ai` service, and FastAPI already expects `/ops/compliance` prefix.
No stripping required since FastAPI routers are defined with `prefix="/ops"`.

### Step 3: Verification
- All routes now registered at both `/ops/...` and `/api/ops/...` paths
- 34 `/api` routes available including compliance endpoints

## Quick Verification Commands
```bash
# Test gateway routing
curl http://localhost:8001/ops/compliance/policy-rules

# Test direct ai-service (what the log shows)
curl http://localhost:8000/api/ops/compliance/policy-rules  # Should 404 currently
curl http://localhost:8000/ops/compliance/policy-rules    # Should work
```