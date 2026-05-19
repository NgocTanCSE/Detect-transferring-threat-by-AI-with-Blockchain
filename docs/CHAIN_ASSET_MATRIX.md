# Chain / Asset Matrix (Canonical)

## 1) Muc tieu

Tai lieu nay la nguon su that duy nhat cho mapping chain, asset, unit, alias va quy tac validate.
Tat ca FE, backend-node, backend FastAPI, DB migration va test phai bam theo.

---

## 2) Canonical Chain Matrix

| Canonical chain | chain_id_evm | Alias accepted | Native asset | Unit label | Decimals | Address format |
|---|---:|---|---|---|---:|---|
| ethereum | 1 | ethereum, eth, 1 | ETH | ETH | 18 | 0x + 40 hex |
| bsc | 56 | bsc, bnb, binance, 56 | BNB | BNB | 18 | 0x + 40 hex |

Quy uoc:
- Moi input chain phai duoc normalize ve canonical key: `ethereum` hoac `bsc`.
- Neu chain khong hop le: tra 400 voi message ro rang.

---

## 3) Asset Matrix (Phase hien tai)

| Asset code | Canonical chain | Asset type | Ho tro transfer | Ho tro dashboard | Ghi chu |
|---|---|---|---|---|---|
| ETH | ethereum | native coin | Yes | Yes | Luong hien tai dang hoat dong |
| BNB | bsc | native coin | Yes (target) | Yes | Se mo trong pha nay |
| BTC | bitcoin | UTXO coin | No (phase sau) | No | Out-of-scope dot hien tai |

Quy uoc:
- Dot nay chi implement EVM native transfer: ETH/BNB.
- BTC chi hien thong bao "chua ho tro" neu co UI placeholder.

---

## 4) UI Binding Matrix

| UI surface | Current state | Target state |
|---|---|---|
| User Exchange title | Hard-code "Send ETH" | Dynamic theo asset: "Send ETH" / "Send BNB" |
| Amount label | "So luong (ETH)" | Dynamic unit theo asset |
| Balance label | "ETH" | Dynamic unit theo asset |
| Transfer button | "Gui ETH" | Dynamic theo asset |
| Risk notice | ETH-centric text | Neutral text theo "asset giao dich" |
| Dashboard chain toggle | ETH/BSC da co | Giu nguyen, data phai doi that theo chain |

---

## 5) API Param Matrix (Target)

### 5.1 Query param

| Param | Type | Required | Default | Allowed |
|---|---|---|---|---|
| chain | string | No | ethereum | ethereum, eth, 1, bsc, bnb, binance, 56 |
| asset | string | No | auto from chain | ETH, BNB |

Rule:
- Neu chi co `chain` -> backend suy ra `asset` native.
- Neu gui ca `chain` va `asset` -> phai hop le theo matrix (VD chain=bsc thi asset=BNB).

### 5.2 Transfer payload (Target)

```json
{
  "from_wallet_id": "...",
  "to_wallet_id": "...",
  "to_address": "0x...",
  "amount": 1.25,
  "chain": "bsc",
  "asset": "BNB",
  "confirm_risk": false
}
```

Backward compatibility:
- Van chap nhan `amount_eth` trong giai doan chuyen tiep.
- Uu tien `amount` neu co dong thoi `amount_eth`.

---

## 6) Database Mapping Matrix

| Table | Column | Meaning | Required index |
|---|---|---|---|
| wallets | chain_id | Chuoi canonical chain (`ethereum`/`bsc`) | idx_wallets_chain_id |
| transactions | chain_id | Chuoi canonical chain (`ethereum`/`bsc`) | idx_transactions_chain_id |
| alerts | metadata.chain_id (hoac column neu bo sung) | Chain cua alert | Optional (depends query pattern) |
| blocked_transfers | metadata/column chain_id (target) | Chain cua blocked transfer | Optional (target phase 2) |

Rule:
- Query thong ke theo chain uu tien loc tren `transactions.chain_id`.
- Du lieu legacy null chain_id phai duoc backfill ve `ethereum`.

---

## 7) Event / WebSocket Matrix

| Event | Mandatory fields | Optional fields |
|---|---|---|
| new-threat | address, score, level, chain, timestamp | message, source, tx_hash |

Rule:
- Frontend co the loc event theo `chain` trung voi chain dang active.
- Neu event khong co chain -> map tam ve `ethereum` va log warning.

---

## 8) Validation Rules

1. Address validation (ETH/BNB): regex `^0x[a-fA-F0-9]{40}$`.
2. Amount: > 0, toi da theo chinh sach he thong.
3. Chain alias: normalize truoc khi xu ly nghiep vu.
4. Asset/chain mismatch: tra 400.

Error contract (goi y):
```json
{
  "error": "INVALID_CHAIN_ASSET_COMBINATION",
  "message": "asset BNB is not valid for chain ethereum"
}
```

---

## 9) Test Matrix toi thieu

1. `chain=ethereum` -> dashboard/flow/alerts co data ETH.
2. `chain=bsc` -> dashboard/flow/alerts co data BSC.
3. Transfer ETH tren ethereum pass.
4. Transfer BNB tren bsc pass (target).
5. `chain=bsc, asset=ETH` -> 400.
6. Alias check: `chain=56` map ve `bsc`.
7. Websocket event co truong `chain`.

---

## 10) Ke hoach mo rong phase sau

1. BTC support:
- Them canonical chain `bitcoin`.
- Them address validator Base58/bech32.
- Tach transfer adapter UTXO.

2. Multi-asset token:
- Ho tro ERC20/BEP20 (USDT, USDC).
- Bo sung token_contract + decimals theo token registry.
