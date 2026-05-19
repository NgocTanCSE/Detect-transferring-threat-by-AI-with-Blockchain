# Ke hoach trien khai chain/asset (chi tiet, nhip nhang)

## 1) Muc tieu tong

Muc tieu cua dot nay la chuyen he thong tu trang thai ETH-centric sang mo hinh chain-aware, asset-aware, van giu duoc do on dinh khi deploy Docker local va Hugging Face.

Ket qua ky vong:
- UI exchange chon asset/chain that su anh huong den payload API va du lieu hien thi.
- Backend loc du lieu theo chain nhat quan tren cac endpoint dashboard, alerts, blocked transfers, flow.
- Node websocket phat su kien theo chain de frontend co the loc dung feed.
- Runtime HF khong mau thuan giua tai lieu va hanh vi thuc te (Postgres vs SQLite).

---

## 2) Scope trien khai

### In scope
- Frontend:
  - User exchange: bo sung asset state, chuan hoa label/placeholder/format theo asset.
  - Dashboard: dam bao chain toggle truyen xuong tat ca API lien quan.
  - Hien thi thong tin chain trong cac widget/su kien real-time.
- Backend FastAPI:
  - Chuan hoa tham so `chain` cho endpoint thong ke, alerts, blocked transfers, flow.
  - Chuan hoa logic truy van theo `transactions.chain_id`, `wallets.chain_id`.
  - Dam bao fallback data cung ton trong theo chain.
- Backend-node:
  - Muc orchestration va websocket bo sung chain context.
  - Canh bao real-time emit theo chain filter duoc.
- Database:
  - Schema/migration bo sung va dong bo cac cot chain_id con thieu.
  - Seed data co phan bo toi thieu cho ETH va BSC.
- Deploy:
  - Dong bo tai lieu deploy HF voi hanh vi runtime.
  - Co smoke test checklist va rollback checklist.

### Out of scope (dot sau)
- Tich hop blockchain BTC native (UTXO) day du.
- On-chain transfer thuc su da chu ky va broadcast.
- Scaling hieu nang cap production (sharding, queue worker tach rieng).

---

## 3) Definition of Done (DoD)

### DoD cap Project
- Tat ca smoke tests local Docker pass.
- Luong exchange thay doi asset/chain co tac dong that len payload va data tra ve.
- Dashboard doi ETH/BSC co thay doi du lieu tai it nhat 3 widget (stats/flow/alerts).
- Khong co regression o auth, register/login, user history, admin diagnostics.
- Co tai lieu cap nhat cho local + HF deploy.

### DoD cap API
- Moi endpoint da khai bao ho tro chain phai:
  - Co gia tri mac dinh ro rang (`ethereum`).
  - Validate alias (`eth`, `1`, `bsc`, `56`) ve canonical.
  - Query dung chain_id trong DB.
  - Co test cho ca truong hop co du lieu va khong co du lieu.

### DoD cap UI
- Khong con text hard-code ETH o cac luong da ho tro multi-asset.
- Gia tri hien thi (don vi, warning, message) doi theo asset/chain.
- Khong co nut toggle nao chi doi mau ma khong doi state nghiep vu.

### DoD cap Deploy
- Entrypoint khong ghi de DATABASE_URL cloud neu nguoi dung da cung cap.
- HF startup logs cho biet dang o mode nao (SQLite local hay Postgres remote).
- Co huong dan rollback nhanh neu migration chain_id gay loi.

---

## 4) Ke hoach theo pha (nhip trien khai)

## Pha 1 - Chot contract va du lieu (Ngay 1)
Muc tieu: tranh sua manh tay roi vo contract FE-BE.

Tasks:
1. Chot ma tran chain/asset canonical:
   - chain alias: `ethereum|eth|1 -> ethereum`, `bsc|bnb|56 -> bsc`.
   - asset phase nay: `ETH` tren chain ethereum, `BNB` tren chain bsc.
2. Chot API contract exchange:
   - Request co `asset`, `chain`, `amount`, `from`, `to`.
   - Response co `chain`, `asset`, `risk_score`, `status`.
3. Chot endpoint dashboard can chain-filter:
   - `/statistics/dashboard`
   - `/alerts/recent`
   - `/blocked-transfers`
   - `/statistics/flow`

Deliverables:
- Bảng contract va mapping alias.
- Danh sach endpoint can sua + expected behavior.

---

## Pha 2 - Implement core (Ngay 2-3)
Muc tieu: thong suot FE -> Node -> FastAPI -> DB theo chain.

Tasks:
1. Frontend exchange:
   - Them asset selector.
   - Truyen `asset/chain` vao API transfer.
   - Doi label unit theo asset.
2. FastAPI:
   - Bo sung chain filter cho endpoint thong ke.
   - Chuan hoa parsing alias chain.
3. DB:
   - Kiem tra cot chain_id tren wallets/transactions.
   - Seed bo sung data BSC toi thieu.
4. Node websocket:
   - Event `new-threat` co field chain.
   - Co kha nang loc event theo chain o frontend.

Deliverables:
- Code chay local Docker, API khong 404/500.
- Dashboard ETH/BSC co khac biet du lieu.

---

## Pha 3 - On dinh va release (Ngay 4)
Muc tieu: giam rui ro deploy va co rollback ro rang.

Tasks:
1. Smoke test local Docker:
   - Health backend/node/frontend.
   - Exchange flow voi 2 chain.
   - Dashboard toggle chain.
2. HF runtime:
   - Dong bo `entrypoint.sh` voi tai lieu deploy.
   - Test startup logs va bootstrap DB mode.
3. Quan sat va rollback:
   - Checklist log can xem.
   - Lenh rollback migration.

Deliverables:
- Checklist runbook deploy + rollback.
- Bien ban test pass/fail.

---

## 5) Test matrix can dat

### FE
- Toggle chain tren dashboard doi API query va doi so lieu.
- Exchange form doi asset thi unit text va payload doi theo.
- Cac trang auth/user/admin khong bi anh huong.

### BE
- Endpoint thong ke tra dung theo ETH va BSC.
- Endpoint transfer van ton tai 3-strike flow.
- Khong pha hu API cu (backward compatibility).

### DB
- Migration idempotent.
- Co index chain_id de query nhanh.
- Seed du de frontend khong thay du lieu trung nhau hoan toan.

### Deploy
- Docker local up/down on dinh.
- HF startup khong ghi de env cloud trai mong doi.

---

## 6) Rui ro va giam thieu

1. Rui ro: Toggle chain nhung du lieu van giong nhau do seed chua phan bo.
- Giam thieu: bo sung seed theo chain va assertions trong smoke test.

2. Rui ro: HF ghi de DATABASE_URL cloud.
- Giam thieu: sua nhanh entrypoint theo uu tien env da co.

3. Rui ro: Regression auth/user flow khi sua proxy/API.
- Giam thieu: test lai login/register/me/user history truoc merge.

4. Rui ro: Socket event flood khi poll nhanh.
- Giam thieu: dedupe theo alert_id + gioi han poll interval.

---

## 7) Checklist release

Truoc merge:
- [ ] Unit va smoke test pass.
- [ ] Manual test 2 chain pass.
- [ ] Khong co loi lint/type moi.
- [ ] Cap nhat tai lieu deploy.

Truoc deploy HF:
- [ ] Verify Space secrets (`DATABASE_URL`, `ALCHEMY_API_KEY`, `JWT_SECRET_KEY`).
- [ ] Confirm mode DB dung ky vong.
- [ ] Backup DB hoac snapshot neu can.

Sau deploy:
- [ ] Check `/` health.
- [ ] Check `/statistics/dashboard?chain=ethereum`.
- [ ] Check `/statistics/dashboard?chain=bsc`.
- [ ] Check login + exchange + alerts realtime.

---

## 8) Nhip van hanh de xuat

- Daily 1 (sang): chot contract + mapping + endpoint scope.
- Daily 1 (chieu): implement backend chain filter.
- Daily 2 (sang): implement frontend asset/chain binding.
- Daily 2 (chieu): websocket + smoke tests.
- Daily 3: hardening deploy HF + rollback drill.

Nguyen tac:
- Moi buoc co testcase nho xac nhan ngay.
- Khong doi qua 1 lop (FE/BE/DB) ma khong re-test end-to-end.
- Uu tien backward compatibility de khong gay dung he thong dang demo.
