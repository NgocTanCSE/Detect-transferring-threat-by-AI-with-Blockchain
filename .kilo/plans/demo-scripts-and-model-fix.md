# Investigation Plan: Demo Scripts & Model Registry Issues

## Issues Identified

### 1. Demo Scripts Not Running
**Root Cause:** `supervisord.conf` chỉ khởi động 3 services:
- `ai-service` (FastAPI backend)
- `scanner` (wallet scanner - chỉ quét, không tạo data)
- `event-service` (Node.js WebSocket)

**Missing Configuration:** Hai scripts demo không được khởi động tự động:
- `demo-scripts/sim_generate_traffic.py` - Tạo giao dịch mẫu (money laundering, layering, clean traffic)
- `demo-scripts/sim_inject_threats.py` - Tiêm kịch bản scam/bảo mật

### 2. Model Registry Returns Empty Data (200 OK)
**Root Cause:** `/admin/diagnostics/seed-data` endpoint trả về count cho `model_registry` nhưng bảng rỗng do chưa có dữ liệu seed.

Endpoints available:
- `GET /ai/model-registry` - Liệt kê tất cả models
- `GET /ai/model-registry/active` - Chỉ models đang active
- `POST /ai/model-registry` - Tạo model mới (yêu cầu admin)

### 3. Diagnostics Logs Endpoint Returns 404
**Root Cause:** Frontend gọi `/api/admin/diagnostics/logs` nhưng backend chỉ đăng ký `/admin/diagnostics/logs` (không có `/api` prefix).

## Proposed Fixes

### Phase A: Add Demo Scripts to Supervisord
Thêm 2 entries vào `supervisord.conf`:
```
[program:demo-traffic]
command=python demo-scripts/sim_generate_traffic.py
directory=/app/backend
environment=DATABASE_URL="postgresql://blockchain:blockchain_pass@postgres_main:5432/blockchain_main"
autostart=true
autorestart=true

[program:demo-threats]  
command=python demo-scripts/sim_inject_threats.py
directory=/app/backend
environment=API_URL="http://localhost:8000"
autostart=true
autorestart=true
```

### Phase B: Seed Model Registry
Tạo script seed hoặc endpoint để thêm dữ liệu mẫu vào ModelRegistry:
- Model: risk_predictor, version: v1.0, framework: pkl, is_active: true
- Artifact URI trỏ tới file model hiện có

### Phase C: Fix Admin Diagnostics Preflight Route
Thêm `/api` prefix cho `/admin/diagnostics/logs` trong `main.py` hoặc tạo redirect.