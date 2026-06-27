# Frontend Pages by Role - Tình trạng tải dữ liệu

## Role Mapping (dashboard-utils.tsx:229-262)

| Role | Short | Sidebar Features |
|------|-------|------------------|
| system_admin | SYS | Health, Organizations, API Access, Pipeline Ops, Diagnostics Logs, SLO Data |
| ai_data_engineer | AI | Model State, Feature State, Feature Ops, Model Ops, Feature Data, Registry Data |
| security_analyst | SEC | Alert Queue, Case Queue, Case Actions, Notifications, Alert Data, Case Data |
| compliance_risk_manager | CMP | Policy State, Audit State, Batch Upload, Reporting, Policy Data, Audit Data |

---

## USER (/user/*) - Trạng thái: ✅ Hoạt động

| Page | Endpoint API | Dữ liệu |
|------|-------------|---------|
| /user/dashboard | /statistics/dashboard, /alerts/recent | ✅ Tải được (overview, threat categories) |
| /user/wallet | /wallet/:address/balance | ✅ Tải được |
| /user/transactions | /user/:address/history | ✅ Tải được |
| /user/batch | (mock) | ⚠️ Cần xác thực API |
| /user/exchange | /protected-transfer | ✅ Gửi được (cần token) |
| /user/history | /user/:address/history | ✅ Tải được |
| /user/profile | /auth/me | ✅ Tải được |
| /user/api | /user/api-keys | ⚠️ Chưa xác thực |

---

## ADMIN (/admin/*) - Trạng thái: ⚠️ Một số endpoint lỗi

| Page | Endpoint API | Dữ liệu | Lỗi |
|------|-------------|---------|-----|
| /admin/dashboard | /api/ops/system/* | ⚠️ Một số endpoint trả về 404 |
| /admin/organizations | /api/ops/organizations | ✅ Tải được | |
| /admin/history | /audit-logs | ✅ Tải được | |
| /admin/tracking | /tracking | ⚠️ Cần kiểm tra | |
| /admin/diagnostics | /api/admin/diagnostics/* | ⚠️ /api/admin/diagnostics/logs trả 404 | Đã fix: thêm /api prefix |

### Admin Dashboard - API Endpoints (live-dashboard.tsx:259-274)

| Role | Endpoints gọi | Trạng thái |
|------|--------------|----------|
| system_admin | /api/ops/system/node-endpoints, /api/ops/system/pipeline-metrics, /api/ops/system/slo-metrics, /api/admin/diagnostics/logs, /api/ops/system/data-integrity | ⚠️ diagnostics/logs đã fix |
| ai_data_engineer | /api/ops/ai/feature-store, /api/ops/ai/model-registry, /api/ops/ai/model-registry/active | ❌ Trả về trống (model_registry rỗng) |
| security_analyst | /api/ops/security/alerts-summary, /api/ops/security/case-summary, /api/ops/security/notifications, /api/cases | ⚠️ Cần seed data |
| compliance_risk_manager | /api/ops/compliance/policy-rules, /api/ops/compliance/reporting/* | ⚠️ Cần seed data |

---

## Model Registry - Vấn đề: ❌ Không có dữ liệu

**Endpoints có sẵn (phase2_ops.py:413-543):**
- GET /ai/model-registry - ❌ Trả về count=0
- GET /ai/model-registry/active - ❌ Trả về rỗng
- POST /ai/model-registry - ✅ Tạo được (yêu cầu admin)

**Giải pháp:**
- Chạy `seed_model_registry.py` để tạo model `risk_predictor:v1.0`
- Model files (.pkl) đã tồn tại: risk_model.pkl, scaler.pkl, feature_names.pkl

---

## Yêu cầu khởi động

1. Seed data: `python seed_model_registry.py && python seed_demo_wallets.py`
2. Demo traffic: Khởi động demo-traffic trong supervisord
3. Kiểm tra: Truy cập /admin/dashboard với role `ai_data_engineer` → Model State panel sẽ hiển thị