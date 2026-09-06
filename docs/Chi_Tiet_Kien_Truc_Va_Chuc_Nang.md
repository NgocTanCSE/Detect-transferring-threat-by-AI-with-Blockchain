# Bóc Tách Chi Tiết Kiến Trúc 4 Tầng (BE, FE, API, Data) & Danh Mục Chức Năng Hệ Thống Blockchain AI Sentinel

> **Dự án**: Trung tâm Giám sát & Phát hiện Nguy cơ Chuyển giao Độc hại Blockchain (Blockchain AI Sentinel SecOps)  
> **Kiến trúc**: 14-Container Microservices Stack + FastAPI AI Multi-Agent + RabbitMQ Event Mesh (DLQ) + PostgreSQL Monthly Partitioning  
> **Cập nhật ngày**: 06/09/2026

---

## MỤC LỤC
1. [Tổng Quan Kiến Trúc Kỹ Thuật Hệ Thống](#1-tổng-quan-kiến-trúc-kỹ-thuật-hệ-thống)
2. [Bóc Tách Tầng Backend (BE Layer)](#2-bóc-tách-tầng-backend-be-layer)
3. [Bóc Tách Tầng Frontend SecOps Portal (FE Layer)](#3-bóc-tách-tầng-frontend-secops-portal-fe-layer)
4. [Bóc Tách Tầng Giao Tiếp API & Message Broker (API Layer)](#4-bóc-tách-tầng-giao-tiếp-api--message-broker-api-layer)
5. [Bóc Tách Tầng Dữ Liệu & Phân Vùng Bảng (Data Layer)](#5-bóc-tách-tầng-dữ-liệu--phân-vùng-bảng-data-layer)
6. [Đặc Tả Chi Tiết Từng Chức Năng Nghiệp Vụ](#6-đặc-tả-chi-tiết-từng-chức-năng-nghiệp-vụ)

---

## 1. Tổng Quan Kiến Trúc Kỹ Thuật Hệ Thống

Blockchain AI Sentinel là trung tâm điều hành an ninh mạng (SecOps) chuyên sâu cho mạng lưới tiền mã hóa và tài chính phi tập trung (DeFi), vận hành dưới dạng một cụm **14 Containers Microservices phân tán**:

```
[Mạng Lưới Blockchain (Ethereum, BSC, Tron)]
                    │
                    ▼ (JSON-RPC / Alchemy WebSocket)
       [Scanner Service (Autonomous Poller)]
                    │
                    ▼
          [RabbitMQ Event Mesh] ──(DLQ)──► [Dead Letter Queue]
       (Topic: blockchain.events)
                    │
    ┌───────────────┼───────────────┬───────────────┐
    ▼               ▼               ▼               ▼
[Alert Service] [Event Service] [Compliance]   [FastAPI AI Sentinel]
   (:3007)      (:3005 - WSS)      (:3006)         (:8000)
    │               │               │               │
    │               └───────┬───────┘               │
    ▼                       ▼                       ▼
[PostgreSQL 16 Partitioned] [Redis 7 Blacklist] [Google Gemini 1.5 Pro]
 (26 Tables, tx_YYYY_MM)     (Latency < 0.5ms)   (Copilot Investigation)
    ▲
    │
[API Gateway (:8001)] ◄─── [Next.js 14 SecOps Dashboard (:3000)]
(Opossum Circuit Breaker)   (Cytoscape Graph, Realtime Threat Stream)
```

---

## 2. Bóc Tách Tầng Backend (BE Layer)

### 2.1. Ngăn Xếp Công Nghệ Đa Ngôn Ngữ
- **Lõi Trí Tuệ Nhân Tạo & Giám Định Chuyên Sâu**: Python 3.11, FastAPI (ASGI Uvicorn), SQLAlchemy 2.0, Scikit-learn, XGBoost, Web3.py, eth-utils, Google Generative AI (Gemini 1.5 Pro).
- **Cụm Vi Dịch Vụ Nghiệp Vụ**: Node.js 20 LTS, Express 4.x, Opossum (Circuit Breaker pattern), Amqplib (RabbitMQ client), Socket.io (WebSocket broadcast).
- **Hạ tầng Message Broker**: RabbitMQ 3.12 hỗ trợ Topic Exchanges và Dead Letter Exchange (DLX) cô lập tin nhắn lỗi.
- **Hạ tầng Giám sát Vận hành**: Prometheus Metrics Scraper, Grafana Dashboard, Endpoint chẩn đoán sức khỏe `/admin/diagnostics/status`.

### 2.2. Danh Mục 14 Dịch Vụ / Containers Độc Lập

| Tên Dịch Vụ | Cổng | Ngôn Ngữ / Công Nghệ | Vai Trò & Trách Nhiệm Kiến Trúc |
|---|:---:|---|---|
| `frontend` | `3000` | Next.js 14 / TypeScript | Giao diện SecOps Portal, đồ thị Cytoscape, biểu đồ rủi ro Recharts |
| `api-gateway` | `8001` | Node.js / Express | Cổng biên bảo mật, Opossum Circuit Breakers, xác thực JWT Bearer |
| `auth-service` | `3001` | Node.js / Express | Quản lý định danh chuyên viên SOC, tổ chức đa khách thuê (`organizations`) |
| `wallet-service` | `3002` | Node.js / Express | Quản lý địa chỉ ví, theo dõi số dư, gắn nhãn định danh (Whale, DEX, Mixer) |
| `transfer-service`| `3003` | Node.js / Express | Khởi tạo và theo dõi tiến trình chuyển giao tài sản số |
| `event-service` | `3005` | Node.js / Socket.io | Đẩy luồng sự kiện cảnh báo thời gian thực lên màn hình chuyên viên qua WebSocket |
| `compliance-service`| `3006` | Node.js / Express | Kiểm soát tuân thủ chống rửa tiền (AML), sàng lọc danh sách trừng phạt OFAC |
| `alert-service` | `3007` | Node.js / Express | Quản lý vòng đời cảnh báo, leo thang sự cố và gửi thông báo khẩn cấp |
| `analytics-service`| `3008` | Python / FastAPI | Phân tích thống kê vĩ mô, tổng hợp xu hướng đe dọa toàn hệ thống |
| `ai-sentinel` | `8000` | Python / FastAPI | Hệ thống Đa Đặc vụ AI (Multi-Agent), chấm điểm Risk Score, Gemini Copilot |
| `scanner-service`| Worker | Python / Web3.py | Quét liên tục các khối mới đào trên mạng lưới blockchain |
| `postgres` | `5432` | PostgreSQL 16 | CSDL sổ cái giao dịch phân vùng theo tháng, 26 thực thể nghiệp vụ |
| `redis` | `6379` | Redis 7 In-Memory | Lưu trữ danh sách đen tốc độ cao (<0.5ms) và bộ đếm Rate Limit |
| `rabbitmq` | `5672` | RabbitMQ 3.12 | Lưới sự kiện tin cậy, phân phối tác vụ song song và lưu trữ thư chết DLQ |

### 2.3. Cấu Trúc Hệ Thống Đa Đặc Vụ AI (`ai-sentinel`)
1. **AML Agent**: Phát hiện kỹ thuật rửa tiền cấu trúc bẻ nhỏ dòng tiền (Smurfing), chuyển tiền qua máy trộn Tornado Cash.
2. **Wash Trading Agent**: Phân tích đồ thị khép kín ($A \rightarrow B \rightarrow C \rightarrow A$) phát hiện giao dịch ảo thổi phồng khối lượng NFT/Token.
3. **Scam & Phishing Agent**: Quét địa chỉ hợp đồng thông minh phát hiện bẫy Honeypot, rút cạn thanh khoản (Rug Pull) hoặc lừa cấp quyền `approve`.
4. **Cổng Can Thiệp Khẩn Cấp (Gate 99 Override)**: Nếu ví nằm trong danh sách đen quốc tế hoặc có chữ ký mã độc đã biết, Risk Score bị ép cứng lên mức **99/100** và phong tỏa tức thì, bỏ qua trọng số của các agent còn lại.

---

## 3. Bóc Tách Tầng Frontend SecOps Portal (FE Layer)

- **Công nghệ**: Next.js 14 App Router, React 18, Tailwind CSS v3, Shadcn UI, Cytoscape.js, Recharts, Socket.io-client.
- **Các Phân Hệ Giao Diện Chính (`frontend/src/app/`)**:
  - `/admin/dashboard`: Bảng điều khiển SOC trực quan, biểu đồ đường rủi ro thời gian thực, đồng hồ đếm giao dịch quét được mỗi giây (TPS).
  - `/admin/alerts`: Danh sách cảnh báo an ninh, phân loại màu sắc (Xanh: An toàn, Vàng: Khả nghi, Đỏ: Nguy hại cực độ).
  - `/admin/cases`: Phòng điều tra chuyên án kỹ thuật số (Case Room):
    - Khung vẽ đồ thị dòng tiền mạng lưới ví đa tầng bằng **Cytoscape.js** (hiển thị ví trung gian, sàn DEX, máy trộn).
    - Khung trò chuyện tích hợp **Trợ lý Gemini AI Copilot** để chuyên viên thẩm vấn về hành vi của nghi can.
  - `/admin/compliance`: Bảng quản trị chính sách AML, danh sách đen OFAC/Interpol, xuất báo cáo kiểm toán SAR.
  - `/admin/system`: Bảng theo dõi sức khỏe 14 microservices (độ trễ p95, tình trạng ngắt mạch Circuit Breaker, độ sâu hàng đợi RabbitMQ).

---

## 4. Bóc Tách Tầng Giao Tiếp API & Message Broker (API Layer)

### 4.1. Ma Trận API Endpoints Trọng Tâm (Qua Gateway :8001 & AI :8000)

| Nhóm Nghiệp Vụ | Method | Endpoint Path | Xử Lý Bảo Vệ / Circuit Breaker | Mục Đích & Dữ Liệu |
|---|---|---|---|---|
| **Cổng Biên (Gateway)** | `POST` | `/api/v1/auth/login` | Rate Limit (5 req/min) | Xác thực chuyên viên SOC, sinh Access Token |
| | `GET` | `/api/v1/wallets/:address` | Circuit Breaker: `WalletBreaker` | Lấy lịch sử giao dịch và nhãn rủi ro của ví |
| | `POST` | `/api/v1/transfers/pre-flight`| Circuit Breaker: `TransferBreaker`| Sàng lọc tuân thủ AML trước khi ký lệnh chuyển tiền |
| | `GET` | `/api/v1/alerts/live` | WebSocket Stream (`/socket.io`) | Nhận cảnh báo đe dọa tức thời từ Event Service |
| **Phân Tích AI** | `POST` | `/api/v1/ai/analyze-transaction`| Throttler | Chấm điểm Risk Score (0-100) cho giao dịch |
| | `POST` | `/api/v1/ai/copilot/investigate`| `JwtAuthGuard` | Trợ lý Gemini 1.5 Pro phân tích chuyên sâu hồ sơ vụ án |
| | `POST` | `/api/v1/ai/feedback` | `Roles(L2_INVESTIGATOR)` | Chuyên viên gắn nhãn True/False để tái huấn luyện AI |
| **Hệ Thống & Quản Trị**| `GET` | `/admin/diagnostics/status` | `Roles(SOC_ADMIN)` | Chẩn đoán tình trạng hoạt động của 14 microservices |
| | `POST` | `/api/v1/compliance/blacklist`| `Roles(COMPLIANCE)` | Bổ sung địa chỉ ví độc hại vào danh sách đen Redis |

### 4.2. Lưới Sự Kiện RabbitMQ & Cơ Chế Dead Letter Queue (DLQ)
- **Topic Exchange `blockchain.events`**:
  - Routing Key `tx.mined`: Chuyển dữ liệu giao dịch mới cho AI Service và Compliance Service phân tích song song.
  - Routing Key `alert.high_risk`: Kích hoạt dịch vụ thông báo đẩy tức thời lên bảng điều khiển SOC.
- **Cơ chế Ngắt Mạch & Hàng Đợi Thư Chết (DLQ)**:
  - Khi `ai-sentinel` gặp sự cố (quá tải hoặc sập container), Circuit Breaker chuyển sang trạng thái `OPEN`.
  - Các bản tin giao dịch không bị mất mà được tự động chuyển hướng vào `blockchain.dlq` (Dead Letter Queue).
  - Khi vi dịch vụ phục hồi (`HALF-OPEN` $\rightarrow$ `CLOSED`), worker tự động kích hoạt cơ chế đọc bù dữ liệu từ DLQ.

---

## 5. Bóc Tách Tầng Dữ Liệu & Phân Vùng Bảng (Data Layer)

### 5.1. Kỹ Thuật Phân Vùng Bảng PostgreSQL Hàng Tháng (Table Partitioning)
Bảng `transactions` là bảng có khối lượng ghi khổng lồ (hàng triệu bản ghi mỗi ngày). Để duy trì tốc độ truy vấn ổn định, hệ thống áp dụng kỹ thuật **Range Partitioning theo cột `created_at`**:
```sql
CREATE TABLE transactions (
    id UUID NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    amount NUMERIC(36, 18),
    chain_id INTEGER NOT NULL,
    risk_score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Các bảng phân vùng con theo từng tháng
CREATE TABLE tx_2026_01 PARTITION OF transactions FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE tx_2026_02 PARTITION OF transactions FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE tx_2026_03 PARTITION OF transactions FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
```
- **Hiệu quả**: Loại bỏ hiện tượng suy giảm hiệu năng khi bảng phình to (Query Pruning tự động loại bỏ các phân vùng không liên quan, tăng tốc độ truy vấn gấp 10 lần).

### 5.2. Danh Mục 26 Thực Thể SQLAlchemy
1. **Sổ Cái & Giao Dịch**: `transactions` (Partitioned), `token_transfers`, `wallets`, `node_endpoints`, `money_flow_snapshots`, `exchange_rate`.
2. **An Ninh & Đe Dọa**: `risk_assessments`, `blacklist`, `alerts`, `blocked_transfers`, `user_warnings`, `ai_threat_logs`.
3. **Chuyên Án & Điều Tra**: `transaction_cases`, `case_evidences`, `suspect_wallets`, `feedback_labels`.
4. **Quản Trị, Tổ Chức & Tuân Thủ**: `organizations`, `users`, `user_profiles`, `auth_sessions`, `policy_rules`, `audit_logs`, `compliance_kpis`, `diagnostic_events`, `system_health_snapshots`, `usage_logs`.

---

## 6. Đặc Tả Chi Tiết Từng Chức Năng Nghiệp Vụ

### Chức Năng 1: Phát Hiện Đe Dọa Giao Dịch Blockchain Tức Thì
- **Tác nhân**: Scanner tự động và Chuyên viên phân tích SOC L1.
- **Luồng hoạt động qua 4 tầng**:
  1. *Scanner*: Bắt sự kiện khối mới số `#21894032` từ nút mạng Ethereum, trích xuất giao dịch chuyển `500,000 USDT`.
  2. *Message*: Đẩy gói tin vào RabbitMQ exchange `blockchain.events` với key `tx.mined`.
  3. *AI Service*:
     - Tra cứu Redis: Ví nhận tiền từng có liên kết với sàn giao dịch chui Garantex (bị trừng phạt).
     - Rút trích 24 đặc trưng giao dịch, đưa vào mô hình Random Forest.
     - Cổng Gate 99 phát hiện vi phạm quy tắc cấm vận quốc tế $\rightarrow$ Ép Risk Score = **99**.
  4. *Data*: Ghi bản ghi vào bảng phân vùng `tx_2026_09` và tạo bản ghi `alerts` mức độ `CRITICAL`.
  5. *FE Display*: Server đẩy sự kiện qua Socket.io; trên màn hình điều khiển SOC xuất hiện cảnh báo đỏ nhấp nháy, tự động phát âm thanh cảnh báo đe dọa nghiêm trọng.

### Chức Năng 2: Mở Chuyên Án Điều Tra & Trợ Lý Gemini AI Copilot
- **Tác nhân**: Kỹ sư An ninh Cấp cao (SecOps Specialist L2).
- **Luồng hoạt động qua 4 tầng**:
  1. *FE*: Chuyên viên nhấp vào cảnh báo, chọn "Mở chuyên án điều tra" (Khởi tạo `Case Dossier #CASE-8821`).
  2. *Trực quan hóa đồ thị*: Gọi API lấy lịch sử liên kết ví, thư viện **Cytoscape.js** vẽ mạng lưới dòng tiền chuyển qua 5 ví trung gian để rửa tiền trước khi rút lên sàn DEX.
  3. *Thẩm vấn Gemini Copilot*: Chuyên viên nhập câu hỏi vào cửa sổ chat: *"Hãy phân tích chuỗi giao dịch này và tóm tắt phương thức tẩu tán tài sản"*.
  4. *BE AI*: Nhồi toàn bộ metadata của chuyên án vào Prompt, gọi Gemini 1.5 Pro sinh báo cáo phân tích chi tiết.
  5. *Hành động ngăn chặn*: Chuyên viên bấm nút "Phong tỏa & Đưa vào Blacklist", hệ thống lưu địa chỉ ví nghi can vào Redis Blacklist trong 0.4ms để ngăn chặn các giao dịch tiếp theo.

### Chức Năng 3: Vòng Lặp Tái Huấn Luyện Mô Hình AI (Human-in-the-Loop)
- **Tác nhân**: Chuyên viên SOC L2 và AI Engineer.
- **Luồng hoạt động qua 4 tầng**:
  1. *FE*: Chuyên viên phát hiện một cảnh báo bị chấm điểm sai (dương tính giả - False Positive do ví tổ chức từ thiện nhận tiền quyên góp lớn).
  2. *API*: Chuyên viên chọn "Gắn nhãn phản hồi" $\rightarrow$ Gửi `POST /api/v1/ai/feedback` với nhãn `FALSE_POSITIVE`.
  3. *BE*: Lưu bản ghi vào bảng `feedback_labels`.
  4. *Tự động tái huấn luyện*: Khi bảng `feedback_labels` tích lũy đủ 1,000 phản hồi mới, một background task được kích hoạt:
     - Trích xuất tập dữ liệu mới, chạy lại quá trình huấn luyện mô hình Scikit-learn.
     - Đánh giá chỉ số AUC-ROC và F1-Score trên tập kiểm thử độc lập.
     - Nếu chỉ số F1 mới $\ge 0.94$ (vượt trội mô hình cũ), hệ thống tự động cập nhật tệp trọng số trong `model_registry` mà không cần khởi động lại máy chủ (Zero-downtime hot reload).

### Chức Năng 4: Chẩn Đoán Sức Khỏe Toàn Diện 14 Dịch Vụ & Cơ Chế Tự Phục Hồi
- **Tác nhân**: Quản trị viên hệ thống (SOC Administrator).
- **Luồng hoạt động qua 4 tầng**:
  1. *BE*: Bộ lập lịch định kỳ mỗi 15 giây gửi yêu cầu HTTP ping đến cổng `/health` của 14 microservices.
  2. *Xử lý lỗi*: Giả sử dịch vụ `compliance-service` bị treo do tràn bộ nhớ:
     - API Gateway phát hiện tỷ lệ timeout vượt quá ngưỡng 50% $\rightarrow$ Ngắt mạch (Circuit Breaker OPEN).
     - Ghi nhận bản ghi sự cố vào bảng `diagnostic_events`.
  3. *Tự phục hồi*: Script giám sát phát hiện container không phản hồi, tự động gửi tín hiệu `docker restart compliance-service`.
  4. *Sau khi khởi động*: Dịch vụ online trở lại, Gateway chuyển sang trạng thái `HALF-OPEN`, thử nghiệm 5 request thành công và tự động đóng mạch (CLOSED) trở lại bình thường trong vòng chưa đầy 12 giây.
  5. *FE Display*: Màn hình `/admin/system` cập nhật đèn trạng thái từ Đỏ $\rightarrow$ Vàng $\rightarrow$ Xanh lục, ghi nhận toàn bộ nhật ký sự cố minh bạch.

---
*Tài liệu được biên soạn và bảo chứng bởi Ban An Ninh Mạng Dự Án Blockchain AI Sentinel.*
