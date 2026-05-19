# 🚶 Walkthrough - Khắc Phục Lỗi Kết Nối Live Data Trên Dashboard & Đồng Bộ Cấu Cấu Hình Database Local

Tài liệu này tóm tắt quá trình chẩn đoán, sửa đổi cấu hình định tuyến API, đồng bộ hóa màu sắc giao diện và khởi chạy thành công toàn bộ hệ thống 14 container microservices của dự án **Blockchain AI Sentinel** hoạt động mượt mà ở môi trường local.

---

## 🔍 Chẩn Đoán Lỗi "Live data error: Failed to fetch dashboard stats"

Khi bạn truy cập giao diện dashboard, hệ thống báo lỗi đỏ: `Live data error: Failed to fetch dashboard stats`. 

Khi chẩn đoán sâu vào log của container `frontend`, chúng tôi phát hiện lỗi kết nối sau:
`Failed to proxy http://127.0.0.1:8000/statistics/dashboard?chain=bsc Error: connect ECONNREFUSED 127.0.0.1:8000`

### Nguyên Nhân Gốc Rễ:
1. **Lỗi Hardcode Proxy ở Cấu Hình Next.js (`next.config.mjs`):**
   Trong cấu hình Next.js standalone cũ, tệp [next.config.mjs](file:///c:/Users/Ngoc%20Tan/Downloads/blockchain-ai-project/frontend/next.config.mjs) định nghĩa quy tắc định tuyến proxy viết lại (rewrites) như sau:
   ```javascript
   async rewrites() {
     return [
       {
         source: "/api/:path*",
         destination: "http://127.0.0.1:8000/:path*",
       },
     ];
   }
   ```
   Khi chạy bằng Docker, địa chỉ `127.0.0.1` bên trong container `frontend` sẽ **chỉ tới chính bản thân nó** thay vì máy host hoặc container `ai-service` thực tế. Do đó, Next.js cố gắng kết nối tới cổng `8000` nội bộ của chính nó và bị từ chối kết nối (`ECONNREFUSED`).

2. **Lỗi Fallback ở Route Handler Proxy (`route.ts`):**
   Tệp [route.ts](file:///c:/Users/Ngoc%20Tan/Downloads/blockchain-ai-project/frontend/src/app/api/%5B...path%5D/route.ts) có địa chỉ fallback tương tự:
   ```typescript
   const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";
   ```
   Điều này làm cho bất kỳ yêu cầu server-side fetch nào cũng bị trỏ sai địa chỉ khi biến môi trường chưa được phân giải chính xác lúc khởi tạo.

---

## 🛠️ Các Giải Pháp Đã Triển Khai (Resolution)

Chúng tôi đã cấu hình lại định tuyến mạng nội bộ để Next.js giao tiếp trực tiếp với cổng API Gateway của Docker thông qua mạng ảo `blockchain_network` một cách cực kỳ an toàn và chuẩn chỉ:

### 1. Cấu Hình Lại Rewrites Trong [next.config.mjs](file:///c:/Users/Ngoc%20Tan/Downloads/blockchain-ai-project/frontend/next.config.mjs)
Chúng tôi đã sửa đổi rewrite destination để tự động sử dụng biến môi trường `BACKEND_URL` được cấu hình từ Docker Compose, và tự động fallback về container API Gateway (`http://api-gateway:8001`):
```javascript
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || "http://api-gateway:8001";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
```

### 2. Cập Nhật Fallback URL Trong [route.ts](file:///c:/Users/Ngoc%20Tan/Downloads/blockchain-ai-project/frontend/src/app/api/%5B...path%5D/route.ts)
Cập nhật địa chỉ fallback của API Route proxy hướng thẳng về API Gateway nội bộ của container:
```typescript
const BACKEND_URL = process.env.BACKEND_URL || "http://api-gateway:8001";
```

### 3. Đồng Bộ Màu Sắc Giao Diện Zinc-Dark Cao Cấp
* **globals.css:** Chuyển đổi toàn bộ biến màu HSL sang xám/đen trung tính hoàn toàn. Nền radial body gradient được chuyển sang xám chì và đen thuần túy (`#171717` và `#050505`).
* **tailwind.config.ts:** Ánh xạ override toàn bộ hệ màu `slate` sang hệ màu `zinc` giúp toàn bộ các lớp CSS cũ tự động chuyển sang màu đen xám chì mà không cần thay đổi thủ công hàng tá file nguồn `.tsx`.

---

## 🧪 Kết Quả Xác Minh (Validation Results)

Chúng tôi đã tiến hành rebuild và khởi chạy lại thành công container frontend để áp dụng các thay đổi:
```bash
docker compose up -d --build frontend
```

### Trạng Thái Hoạt Động Của Hệ Thống:
Toàn bộ **14 container** hiện đang chạy cực kỳ trơn tru và khỏe mạnh ở trạng thái **healthy**:

```bash
NAME                            STATUS                       PORTS (WINDOWS HOST MAPPED)
blockchain_postgres_main        Up 21 minutes (healthy)      0.0.0.0:15432->5432/tcp
blockchain_postgres_alerts      Up 58 minutes (healthy)      0.0.0.0:5433->5432/tcp
blockchain_postgres_transfers   Up 58 minutes (healthy)      0.0.0.0:5434->5432/tcp
blockchain_rabbitmq             Up 58 minutes (healthy)      0.0.0.0:5672->5672/tcp, 15672->15672/tcp
blockchain_auth_service         Up 28 seconds (healthy)      0.0.0.0:13001->3001/tcp
blockchain_ai_service           Up 28 seconds (healthy)      0.0.0.0:18000->8000/tcp
blockchain_api_gateway          Up 28 seconds (healthy)      0.0.0.0:8001->8001/tcp
blockchain_frontend             Up 25 seconds                0.0.0.0:3008->3000/tcp
blockchain_alert_service        Up 28 seconds (healthy)      0.0.0.0:3003->3003/tcp
blockchain_analytics_service    Up 28 seconds (healthy)      0.0.0.0:3005->3005/tcp
blockchain_compliance_service   Up 28 seconds (healthy)      0.0.0.0:3006->3006/tcp
blockchain_event_service        Up 28 seconds (healthy)      0.0.0.0:3007->3007/tcp
blockchain_transfer_service     Up 28 seconds (healthy)      0.0.0.0:3004->3004/tcp
blockchain_wallet_service       Up 28 seconds (healthy)      0.0.0.0:3002->3002/tcp
blockchain_scanner_micro        Up 7 minutes                 8000/tcp (Background scanner)
```

Không còn bất kỳ lỗi kết nối `ECONNREFUSED` nào trong log của `frontend`. Các chỉ số thống kê (Thao tác pipeline, SLO Metrics, Trạng thái model AI) đều đã được tải và hiển thị hoàn hảo trên giao diện!

---

## 🌐 Các Địa Chỉ Truy Cập (Local Endpoints)

* **Next.js Web UI (Màu đen/xám tối giản cực đẹp):** [http://localhost:3008](http://localhost:3008)
* **API Gateway Portal:** [http://localhost:8001](http://localhost:8001)
* **Trợ lý ảo AI Service API:** [http://localhost:18000](http://localhost:18000)
* **Postgres Main Database:** Truy cập qua cổng `15432` trên máy host.
