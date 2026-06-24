"""AI-only router for the Blockchain AI Sentinel service.

This router contains only AI-related endpoints, separating them from
the legacy monolith endpoints that duplicate microservice functionality.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import Wallet, Transaction, Blacklist, User, RiskAssessment, BlockedTransfer, UserWarning, ExchangeRate, FeedbackLabel, Alert, AuditLog
from app.admin_diagnostics import log_diagnostic, DiagnosticLogType
from app.utils.api_response import api_success
from app.auth import optional_auth, require_admin, admin_or_analyst

logger = logging.getLogger(__name__)
router = APIRouter(prefix="", tags=["AI Service"])

@router.get("/diagnostics/alchemy/{wallet_address}")
def diagnose_alchemy_wallet(wallet_address: str, chain: str = Query("ethereum"), current_user: Optional[User] = Depends(optional_auth)) -> Dict[str, Any]:
    from app.core.config import ALCHEMY_API_KEY, ALCHEMY_ETH_RPC_URL, ALCHEMY_BSC_RPC_URL
    from blockchain_client import fetch_wallet_history
    if not ALCHEMY_API_KEY:
        return {"configured": False, "wallet_address": wallet_address, "data_available": False, "transfer_count": 0, "note": "ALCHEMY_API_KEY is missing"}
    try:
        transfers = fetch_wallet_history(wallet_address, chain=chain, max_count=10)
        sample = transfers[0] if transfers else None
        return {"configured": True, "rpc_url_ready": bool(ALCHEMY_ETH_RPC_URL if chain == "ethereum" else ALCHEMY_BSC_RPC_URL), "wallet_address": wallet_address, "data_available": len(transfers) > 0, "transfer_count": len(transfers), "sample_transfer": {"tx_hash": sample.get("tx_hash") if sample else None, "from_address": sample.get("from_address") if sample else None, "to_address": sample.get("to_address") if sample else None, "category": sample.get("category") if sample else None, "block_number": sample.get("block_number") if sample else None, "timestamp": sample["timestamp"].isoformat() if sample and isinstance(sample.get("timestamp"), datetime) else None}, "note": "Alchemy fetch executed directly"}
    except Exception as error:
        return {"configured": True, "rpc_url_ready": bool(ALCHEMY_ETH_RPC_URL if chain == "ethereum" else ALCHEMY_BSC_RPC_URL), "wallet_address": wallet_address, "data_available": False, "transfer_count": 0, "sample_transfer": None, "error": str(error), "note": "Alchemy call failed"}

@router.get("/analyze/{wallet_address}")
def analyze_wallet_risk(wallet_address: str, chain: str = Query("ethereum"), database_session: Session = Depends(get_db), current_user: Optional[User] = Depends(optional_auth)) -> Dict[str, Any]:
    from blockchain_client import fetch_wallet_history
    from app.services.ai_engine import MultiAgentDetectionEngine
    from app.services.persistence import persist_transactions
    normalized = wallet_address.lower().strip()
    if not normalized.startswith("0x") or len(normalized) != 42:
        raise HTTPException(status_code=400, detail="Invalid wallet address")
    def _rl(s): return "CRITICAL" if s >= 90 else "HIGH" if s >= 80 else "MEDIUM" if s >= 50 else "LOW"
    bl = database_session.query(Blacklist).filter(Blacklist.address == normalized).first()
    if bl:
        return {"address": normalized, "risk_score": 100.0, "risk_level": "CRITICAL", "details": {"money_laundering": {"detected": False, "confidence": 0.0, "reasons": []}, "wash_trading": {"detected": False, "confidence": 0.0, "reasons": []}, "scam": {"detected": True, "confidence": 1.0, "reasons": ["Blacklist Match"]}}, "detection_count": 1, "model": "Blacklist-Check", "cached": True, "blacklisted": True, "transaction_count": 0, "recent_transactions": []}
    try:
        tx_history = fetch_wallet_history(normalized, chain=chain, max_count=50)
        if not tx_history:
            wr = database_session.query(Wallet).filter(Wallet.address == normalized).first()
            la = database_session.query(Alert).filter(Alert.wallet_address == normalized).order_by(Alert.detected_at.desc()).first()
            cs = 0.0
            if wr and wr.risk_score is not None:
                cs = max(cs, float(wr.risk_score))
            if la and la.risk_score is not None:
                cs = max(cs, float(la.risk_score))
            return {"address": normalized, "risk_score": cs, "risk_level": _rl(cs), "details": {"money_laundering": {"detected": False, "confidence": 0.0, "reasons": []}, "wash_trading": {"detected": False, "confidence": 0.0, "reasons": []}, "scam": {"detected": False, "confidence": 0.0, "reasons": []}}, "detection_count": 0, "model": "Cached-DB", "cached": True, "blacklisted": False, "first_seen_at": wr.first_seen_at.isoformat() if wr and wr.first_seen_at else None, "last_activity_at": wr.last_activity_at.isoformat() if wr and wr.last_activity_at else None, "transaction_count": 0, "recent_transactions": []}
        else:
            persist_transactions(database_session, tx_history, normalized)
            ai = MultiAgentDetectionEngine(database_session=database_session)
            ra = ai.analyze_wallet(wallet_address=normalized, transactions=tx_history)
            wr = database_session.query(Wallet).filter(Wallet.address == normalized).first()
            if not wr:
                wr = Wallet(address=normalized, risk_score=ra["total_score"], total_transactions=len(tx_history), first_seen_at=tx_history[-1].get("timestamp") if tx_history else None, last_activity_at=tx_history[0].get("timestamp") if tx_history else None)
                database_session.add(wr)
                database_session.commit()
                database_session.refresh(wr)
            else:
                wr.risk_score = ra["total_score"]
                wr.total_transactions = len(tx_history)
                wr.last_activity_at = tx_history[0].get("timestamp") if tx_history else None
                wr.updated_at = datetime.now(timezone.utc)
                database_session.commit()
            ar = RiskAssessment(wallet_id=wr.id, score=ra["total_score"], risk_level=ra["risk_level"], details={**ra["breakdown"], "ai_insight": ra.get("ai_insight")}, model_version=ra.get("model", "Multi-Agent-v1.0"))
            database_session.add(ar)
            database_session.commit()
            return {"address": normalized, "risk_score": ra["total_score"], "risk_level": ra["risk_level"], "details": ra["breakdown"], "ai_insight": ra.get("ai_insight", ""), "suggested_actions": ra.get("suggested_actions", []), "detection_count": ra["detection_count"], "model": ra["model"], "cached": False, "first_seen_at": wr.first_seen_at.isoformat() if wr.first_seen_at else None, "last_activity_at": wr.last_activity_at.isoformat() if wr.last_activity_at else None, "transaction_count": len(tx_history), "recent_transactions": [{**tx, "timestamp": tx["timestamp"].isoformat() if isinstance(tx.get("timestamp"), datetime) else str(tx.get("timestamp"))} for tx in tx_history[:10]]}
    except Exception as ae:
        logger.error(f"Analysis failed for {normalized}: {ae}")
        raise HTTPException(status_code=500, detail=f"Risk analysis failed: {str(ae)}")


@router.get("/predict/{wallet_address}")
def predict_wallet_risk(wallet_address: str, chain: str = Query("ethereum"), database_session: Session = Depends(get_db), current_user: Optional[User] = Depends(optional_auth)) -> Dict[str, Any]:
    from blockchain_client import fetch_wallet_history
    from app.services.persistence import persist_transactions
    from app.services.ai_engine import MLRiskPredictor
    normalized = wallet_address.lower().strip()
    if not normalized.startswith("0x") or len(normalized) != 42:
        raise HTTPException(status_code=400, detail="Invalid wallet address")
    txs = database_session.query(Transaction).filter(((Transaction.from_address == normalized) | (Transaction.to_address == normalized)) & (Transaction.chain_id == chain)).order_by(Transaction.timestamp.desc().nullslast(), Transaction.created_at.desc()).limit(100).all()
    if not txs:
        history = fetch_wallet_history(normalized, chain=chain, max_count=50)
        if history:
            persist_transactions(database_session, history, normalized)
            txs = database_session.query(Transaction).filter((Transaction.from_address == normalized) | (Transaction.to_address == normalized)).order_by(Transaction.timestamp.desc().nullslast(), Transaction.created_at.desc()).limit(100).all()
    if not txs:
        return {"address": normalized, "ml_score": 0.0, "ml_confidence": 0.0, "ml_available": False, "transaction_count": 0, "reason": "No transactions found"}
    tx_dicts = [{"tx_hash": tx.tx_hash, "from_address": tx.from_address, "to_address": tx.to_address, "value": int(tx.value or 0), "timestamp": tx.timestamp.isoformat() if tx.timestamp else None, "gas_price": int(tx.gas_price or 0), "gas_used": int(tx.gas_used or 0), "block_number": int(tx.block_number or 0), "chain_id": tx.chain_id} for tx in txs]
    predictor = MLRiskPredictor()
    if not predictor.is_available:
        return {"address": normalized, "ml_score": 0.0, "ml_confidence": 0.0, "ml_available": False, "transaction_count": len(txs), "reason": "Model artifacts not available"}
    result = predictor.predict_risk(normalized, tx_dicts)
    return {"address": normalized, "ml_score": result.get("risk_score", 0.0), "risk_level": result.get("risk_level", "LOW"), "ml_confidence": result.get("confidence", 0.0), "feature_importances": result.get("feature_importances", {}), "model_version": result.get("model_version", "unknown"), "ml_available": True, "transaction_count": len(txs)}

@router.get("/user/{wallet_address}/history")
def get_user_history(wallet_address: str, current_user: Optional[User] = Depends(optional_auth), database_session: Session = Depends(get_db)) -> Dict[str, Any]:
    normalized = wallet_address.lower().strip()
    blocked = database_session.query(BlockedTransfer).filter(BlockedTransfer.sender_address == normalized).order_by(BlockedTransfer.blocked_at.desc()).limit(50).all()
    transactions = database_session.query(Transaction).filter((Transaction.from_address == normalized) | (Transaction.to_address == normalized)).order_by(Transaction.timestamp.desc().nullslast()).limit(50).all()
    warnings = database_session.query(UserWarning).filter(UserWarning.wallet_address == normalized).order_by(UserWarning.created_at.desc()).limit(20).all()
    return {"wallet_address": normalized, "blocked_transfers": [{"id": str(b.id), "sender_address": b.sender_address, "receiver_address": b.receiver_address, "amount_eth": float(b.amount or 0) / 1e18, "risk_score": float(b.risk_score or 0), "block_reason": b.block_reason, "user_warning_count": b.user_warning_count, "blocked_at": b.blocked_at.isoformat() if b.blocked_at else None} for b in blocked], "successful_transactions": [{"id": str(tx.id), "tx_hash": tx.tx_hash, "from_address": tx.from_address, "to_address": tx.to_address, "value_eth": float(tx.value or 0) / 1e18, "direction": "sent" if tx.from_address == normalized else "received", "timestamp": tx.timestamp.isoformat() if tx.timestamp else None, "status": int(tx.status or 1), "is_flagged": bool(tx.is_flagged), "flag_reason": tx.flag_reason} for tx in transactions], "warnings": [{"id": str(w.id), "wallet_address": w.wallet_address, "target_address": w.target_address, "warning_type": w.warning_type, "risk_score": float(w.risk_score or 0), "user_action": w.user_action, "warning_number": w.warning_number, "created_at": w.created_at.isoformat() if w.created_at else None} for w in warnings], "summary": {"total_blocked": len(blocked), "total_transactions": len(transactions), "total_warnings": len(warnings), "warning_count": len([w for w in warnings if w.user_action == "ignored"])}}

@router.get("/exchange/rate")
def get_exchange_rate(chain: str = "ethereum", current_user: Optional[User] = Depends(optional_auth), database_session: Session = Depends(get_db)) -> Dict[str, Any]:
    cn = chain.lower().strip()
    rows = database_session.query(ExchangeRate).filter(ExchangeRate.chain == cn).all()
    if not rows:
        return {"chain": cn, "rates": {}, "updated_at": datetime.now(timezone.utc).isoformat()}
    rates = {r.to_currency.lower(): float(r.rate) for r in rows}
    ua = max((r.updated_at for r in rows if r.updated_at), default=datetime.now(timezone.utc))
    return {"chain": cn, "rates": rates, "updated_at": ua.isoformat()}

@router.post("/exchange/estimate")
def estimate_exchange(payload: Dict[str, Any], current_user: Optional[User] = Depends(optional_auth), database_session: Session = Depends(get_db)) -> Dict[str, Any]:
    class ExchangeEstimateRequest(BaseModel):
        from_currency: str = "ETH"
        to_currency: str = "USD"
        amount: float = 0
    req = ExchangeEstimateRequest(**payload)
    from_currency = req.from_currency.upper()
    to_currency = req.to_currency.upper()
    amount = req.amount
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    rate_row = database_session.query(ExchangeRate).filter(ExchangeRate.from_currency == from_currency, ExchangeRate.to_currency == to_currency).first()
    if not rate_row:
        raise HTTPException(status_code=400, detail=f"Unsupported pair: {from_currency} -> {to_currency}")
    rate = float(rate_row.rate)
    return {"from": from_currency, "to": to_currency, "amount_in": amount, "amount_out": round(amount * rate, 6), "rate": rate}

class SubmitFeedbackRequest(BaseModel):
    wallet_address: str = ""
    admin_label: str = ""
    admin_category: Optional[str] = None
    admin_notes: Optional[str] = None
    admin_username: str = "anonymous"

@router.post("/feedback")
def submit_ai_feedback(payload: SubmitFeedbackRequest, admin: User = Depends(require_admin), database_session: Session = Depends(get_db)) -> Dict[str, Any]:
    wallet_address = payload.wallet_address.lower().strip()
    admin_label = payload.admin_label.lower().strip()
    if not wallet_address:
        raise HTTPException(status_code=400, detail="Invalid wallet_address")
    if admin_label not in ["fraud", "safe", "uncertain"]:
        raise HTTPException(status_code=400, detail="Invalid admin_label")
    wallet = database_session.query(Wallet).filter(Wallet.address == wallet_address).first()
    ai_score = float(wallet.risk_score or 0) if wallet else 0.0
    feedback = FeedbackLabel(wallet_address=wallet_address, ai_score=ai_score, ai_risk_level="HIGH" if ai_score >= 70 else "MEDIUM" if ai_score >= 50 else "LOW", ai_model_version="Multi-Agent-v1.0", admin_label=admin_label, admin_category=payload.admin_category, admin_notes=payload.admin_notes, admin_username=payload.admin_username)
    database_session.add(feedback)
    if wallet and admin_label == "fraud":
        wallet.account_status = "frozen"
        database_session.add(Blacklist(address=wallet_address, category=payload.admin_category or "admin_flagged", source=f"Admin: {payload.admin_username}", description=payload.admin_notes or "Confirmed fraud by admin", severity="CRITICAL"))
    elif wallet and admin_label == "safe":
        wallet.account_status = "active"
        wallet.risk_score = max(0, wallet.risk_score - 20) if wallet.risk_score else 0
    database_session.add(AuditLog(action_type="FEEDBACK_SUBMITTED", entity_type="wallet", user_identifier=payload.admin_username, details={"wallet_address": wallet_address, "ai_score": ai_score, "admin_label": admin_label}))
    database_session.commit()
    unlabeled = database_session.query(FeedbackLabel).filter(FeedbackLabel.used_for_training == False).count()
    return {"success": True, "feedback_id": str(feedback.id), "wallet_address": wallet_address, "admin_label": admin_label, "ai_score_at_time": ai_score, "wallet_status_updated": wallet.account_status if wallet else None, "unlabeled_samples_for_training": unlabeled}

@router.get("/feedback/stats")
def get_feedback_stats(current_user: User = Depends(admin_or_analyst), database_session: Session = Depends(get_db)) -> Dict[str, Any]:
    total = database_session.query(FeedbackLabel).count()
    unlabeled = database_session.query(FeedbackLabel).filter(FeedbackLabel.used_for_training == False).count()
    counts = database_session.query(FeedbackLabel.admin_label, func.count(FeedbackLabel.id)).group_by(FeedbackLabel.admin_label).all()
    return {"total_feedback": total, "unlabeled_for_training": unlabeled, "used_for_training": total - unlabeled, "by_label": {l: c for l, c in counts}, "ready_for_retraining": unlabeled >= 50}
