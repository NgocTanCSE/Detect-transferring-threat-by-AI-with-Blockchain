# Exchange API Contract (v2)

## 1) Muc tieu

Tai lieu nay chot contract cho luong chuyen tien user exchange theo chain/asset, dam bao:
- Ho tro ETH (ethereum) va BNB (bsc) trong dot hien tai.
- Khong pha API cu dang dung `amount_eth`.
- Co lo trinh chuyen doi an toan sang payload moi.

---

## 2) Endpoint pham vi

### 2.1 Primary endpoint
- `POST /transfer/protected`

### 2.2 Legacy-compatible endpoint
- `POST /send-with-warning`

Ghi chu:
- Dot nay uu tien chuan hoa contract o `POST /transfer/protected`.
- `POST /send-with-warning` duoc giu cho backward compatibility, se gom ve chung service layer sau.

---

## 3) Request Contract

### 3.1 Request body (v2 target)

```json
{
  "from_wallet_id": "string",
  "to_wallet_id": "string",
  "to_address": "0x...",
  "amount": 1.25,
  "chain": "ethereum",
  "asset": "ETH",
  "confirm_risk": false,
  "metadata": {
    "source": "frontend-user-exchange"
  }
}
```

### 3.2 Request body (v1 legacy - van ho tro)

```json
{
  "from_wallet_id": "string",
  "to_wallet_id": "string",
  "to_address": "0x...",
  "amount_eth": 1.25,
  "confirm_risk": false
}
```

### 3.3 Parse precedence

1. `amount` (neu co) duoc uu tien.
2. Neu khong co `amount`, fallback sang `amount_eth`.
3. Neu ca hai deu thieu hoac <= 0 -> 400.

### 3.4 Chain/asset defaults

- `chain` default: `ethereum`
- `asset` default: native asset cua chain
  - ethereum -> ETH
  - bsc -> BNB

### 3.5 Alias normalization

- ethereum aliases: `ethereum`, `eth`, `1`
- bsc aliases: `bsc`, `bnb`, `binance`, `56`

Sau normalize, gia tri canonical phai la:
- `chain`: `ethereum` hoac `bsc`
- `asset`: `ETH` hoac `BNB`

### 3.6 Validation rules

1. `to_address` phai dung format EVM: `^0x[a-fA-F0-9]{40}$`.
2. `amount` > 0.
3. `asset` phai dung voi `chain`:
   - `ethereum` <-> `ETH`
   - `bsc` <-> `BNB`
4. Neu mismatch -> 400 `INVALID_CHAIN_ASSET_COMBINATION`.

---

## 4) Response Contract

### 4.1 Success

```json
{
  "status": "success",
  "message": "Transaction completed successfully",
  "tx_hash": "0x... or sim_...",
  "chain": "ethereum",
  "asset": "ETH",
  "amount": 1.25,
  "risk": {
    "receiver_risk": 22.5,
    "level": "LOW"
  },
  "meta": {
    "fallback": false
  }
}
```

### 4.2 Warning (risk 50-80)

```json
{
  "status": "warning",
  "requires_confirmation": true,
  "message": "...",
  "chain": "bsc",
  "asset": "BNB",
  "receiver_risk": 72.4,
  "current_warnings": 1,
  "max_warnings": 3,
  "warning_text": "..."
}
```

### 4.3 Blocked

```json
{
  "status": "blocked",
  "message": "Receiver is high-risk or blocked",
  "chain": "ethereum",
  "asset": "ETH",
  "receiver_risk": 91.2,
  "reason_code": "HIGH_RISK_RECEIVER"
}
```

### 4.4 Error envelope (goi y)

```json
{
  "error": "INVALID_CHAIN_ASSET_COMBINATION",
  "message": "asset BNB is not valid for chain ethereum",
  "details": {
    "chain": "ethereum",
    "asset": "BNB"
  }
}
```

---

## 5) HTTP Status Matrix

| Scenario | Status |
|---|---:|
| Request hop le, transfer thanh cong | 200 |
| Request hop le, canh bao can confirm | 200 |
| Request hop le, bi block theo policy | 200 or 403 (chon 1 chuan, de xuat 200 + status=blocked) |
| Validation fail (address, amount, chain/asset) | 400 |
| Rate limit | 429 |
| Auth fail (neu bat auth strict) | 401/403 |
| Internal error | 500 |

De xuat nhat quan cho FE:
- Dung status field (`success|warning|blocked`) de render UI.
- Han che dung 403 cho blocked nghiep vu neu FE da built theo response body.

---

## 6) Backward Compatibility Plan

## Phase A (hien tai)
- Backend chap nhan ca `amount` va `amount_eth`.
- Response bo sung `chain` va `asset` nhung van giu cac field cu (`receiver_risk`, ...).

## Phase B
- Frontend chuyen hoan toan sang gui `amount` + `chain` + `asset`.
- Theo doi logs de xem con client nao gui `amount_eth`.

## Phase C
- Deprecate `amount_eth` (canh bao log).
- Sau 2 release cycle moi remove hard.

---

## 7) Logging va Observability

Moi request transfer nen log:
- `request_id`
- `chain`
- `asset`
- `amount`
- `risk_score`
- `decision` (`success|warning|blocked`)
- `fallback_mode` (neu co)

Muc tieu:
- Do ti le blocked theo chain.
- Do mismatch request tu FE.
- Khoanh vung nhanh regression sau deploy.

---

## 8) Test Cases toi thieu

1. `chain=ethereum, asset=ETH, amount=1` -> success/warning/blocked hop le.
2. `chain=bsc, asset=BNB, amount=1` -> success/warning/blocked hop le.
3. `chain=56, asset=BNB` -> alias map dung.
4. `chain=bsc, asset=ETH` -> 400.
5. Chi gui `amount_eth` -> van chay (legacy).
6. Gui ca `amount` va `amount_eth`, khac gia tri -> dung `amount`.
7. Address sai format -> 400.
8. Amount <= 0 -> 400.

---

## 9) Mapping voi cac file hien tai

- FE API client: `frontend/src/lib/api.ts`
- FE page exchange: `frontend/src/app/user/exchange/page.tsx`
- FastAPI transfer endpoint: `backend/app/main.py`
- Node orchestration (neu route compliance): `backend-node/src/controllers/transactionController.js`

Tai lieu lien quan:
- `CHAIN_ASSET_MATRIX.md`
- `IMPLEMENTATION_PLAN_CHAIN_ASSET.md`
