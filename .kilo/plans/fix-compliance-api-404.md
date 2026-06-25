# Plan: Fix Compliance API 404 Errors

## Status: ✅ COMPLETED

## Problem Summary
The frontend calls `/api/ops/compliance/...` endpoints resulting in 404 errors. Logs show FastAPI is receiving `/api/ops/compliance/...` but it has no routes with `/api` prefix.

## Root Cause Analysis

### Architecture
```
Frontend → Next.js rewrite (/api → gateway:8001) → API Gateway → Backend Service
```

### The Real Issue
The FastAPI backend (running on port 8000) receives requests at `/api/ops/compliance/policy-rules` but its routes are defined at `/ops/compliance/policy-rules` (without `/api` prefix). The Next.js rewrite should strip `/api` but it appears the requests are reaching FastAPI with the `/api` prefix intact.

**Evidence from logs:**
- Log format `[no-id] ... - app.main - INFO` is Python/FastAPI logging
- Path `/api/ops/compliance/policy-rules` shows the `/api` prefix is NOT being stripped

### Route Mapping Conflicts
The API Gateway has inconsistent routing:
- `/ops/compliance` → `compliance` service (Node.js)
- `/ops/security` → `ai` service (FastAPI)
- Other `/ops/*` endpoints are split between services

The frontend expects ALL `/ops/compliance/*` endpoints to work through the gateway, but:
1. Some routes go to compliance-service (Node.js)
2. Some endpoints are only in the FastAPI backend (like reporting endpoints)

## Solution: Route all `/ops/compliance/*` to AI/FastAPI service

This consolidates compliance endpoints in one place and ensures consistent behavior.

## Implementation Steps

### Step 1: Update API Gateway ROUTE_MAP
**File**: `services/api-gateway/src/index.js`

Change:
```javascript
'/ops/compliance': 'compliance',
```
To:
```javascript
'/ops/compliance': 'ai',
```

### Step 2: Add STRIP_PREFIXES for ai service
**File**: `services/api-gateway/src/index.js`

Since FastAPI routes are at `/ops/...` without `/api`, we need to ensure the prefix stripping works correctly when routing to `ai` service.

### Step 3: Verify compliance-service still handles `/compliance/*` for backward compat
The compliance-service should still handle `/compliance/*` paths (without `/ops`) for direct access.

## Expected Outcome After Fix
- `GET /api/ops/compliance/policy-rules` → Gateway → AI service → Returns policy rules
- `GET /api/ops/compliance/reporting/summary` → Gateway → AI service → Returns summary
- `GET /api/ops/compliance/reporting/audit-gaps` → Gateway → AI service → Returns gaps
- `GET /api/ops/compliance/reporting/audit-completeness` → Gateway → AI service → Returns completeness

## Implementation
Changes made to `services/api-gateway/src/index.js`:

### Step 1: Updated ROUTE_MAP
Changed `/ops/compliance` routing from `compliance` service to `ai` service.

### Step 2: Updated STRIP_PREFIXES
Removed `/ops/compliance` from compliance service prefix stripping since it no longer routes there.
Kept `/compliance` in compliance service stripping for backward compatibility with direct paths.

### Verification
- FastAPI tests pass for `/ops/compliance/policy-rules` and `/ops/compliance/reporting/summary` endpoints
- FastAPI backend has routes defined with `prefix="/ops"` in routers (phase3_governance.py, phase4_reporting.py)