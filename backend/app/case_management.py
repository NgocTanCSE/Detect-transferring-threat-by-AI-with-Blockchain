"""Case management APIs for analyst workflow (assign, confirm fraud, dismiss, escalate)."""

from datetime import datetime
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditLog, Transaction, TransactionCase, User

router = APIRouter(prefix="/cases", tags=["Case Management"])

TX_STATES = {"PENDING", "VERIFIED", "FRAUD", "IGNORED"}
CASE_ACTIONS = {"ASSIGN", "CONFIRM_FRAUD", "DISMISS", "ESCALATE"}


class AssignCaseRequest(BaseModel):
    assigned_to: Optional[str] = Field(default=None, description="User UUID of analyst")
    assigned_by: Optional[str] = None
    note: Optional[str] = None


class CaseActionRequest(BaseModel):
    action: str = Field(description="CONFIRM_FRAUD | DISMISS | ESCALATE")
    analyst_id: Optional[str] = None
    note: Optional[str] = None


class BulkAssignRequest(BaseModel):
    tx_hashes: List[str]
    assigned_to: Optional[str] = None
    assigned_by: Optional[str] = None
    note: Optional[str] = None


def _parse_uuid(raw_id: Optional[str], field_name: str) -> Optional[uuid.UUID]:
    if not raw_id:
        return None
    try:
        return uuid.UUID(raw_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid UUID for {field_name}") from exc


def _load_user_if_present(db: Session, user_id: Optional[uuid.UUID], field_name: str) -> Optional[User]:
    if not user_id:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User not found for {field_name}")
    return user


def _validate_transition(current_state: str, next_state: str) -> None:
    allowed = {
        "PENDING": {"VERIFIED", "FRAUD", "IGNORED"},
        "VERIFIED": {"FRAUD", "IGNORED"},
        "FRAUD": set(),
        "IGNORED": set(),
    }

    if next_state not in TX_STATES:
        raise HTTPException(status_code=400, detail=f"Invalid target state: {next_state}")

    if next_state == current_state:
        return

    if next_state not in allowed.get(current_state, set()):
        raise HTTPException(
            status_code=409,
            detail=f"Invalid state transition: {current_state} -> {next_state}",
        )


def _write_audit_log(
    db: Session,
    action_type: str,
    tx_hash: str,
    user_identifier: Optional[str],
    details: Dict[str, Any],
) -> None:
    db.add(
        AuditLog(
            action_type=action_type,
            entity_type="transaction",
            user_identifier=user_identifier,
            details={"tx_hash": tx_hash, **details},
        )
    )


@router.get("", summary="List cases for analyst board")
def list_cases(
    min_risk: float = Query(default=0.80, ge=0, le=1),
    status: Optional[str] = Query(default=None),
    assigned_to: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    assigned_uuid = _parse_uuid(assigned_to, "assigned_to") if assigned_to else None

    query = db.query(Transaction)

    if status:
        normalized_status = status.upper().strip()
        if normalized_status not in TX_STATES:
            raise HTTPException(status_code=400, detail="Invalid status filter")
        query = query.filter(Transaction.case_status == normalized_status)

    if assigned_uuid:
        query = query.filter(Transaction.assigned_to == assigned_uuid)

    query = query.filter(
        or_(
            Transaction.normalized_risk_score >= min_risk,
            Transaction.is_flagged.is_(True),
        )
    )

    records = (
        query.order_by(
            Transaction.updated_at.desc().nullslast(),
            Transaction.timestamp.desc().nullslast(),
            Transaction.created_at.desc(),
        )
        .limit(limit)
        .all()
    )

    return {
        "count": len(records),
        "min_risk": min_risk,
        "cases": [
            {
                "tx_hash": tx.tx_hash,
                "from_address": tx.from_address,
                "to_address": tx.to_address,
                "value": str(tx.value or 0),
                "risk_score": float(tx.normalized_risk_score) if tx.normalized_risk_score is not None else None,
                "status": tx.case_status,
                "assigned_to": str(tx.assigned_to) if tx.assigned_to else None,
                "is_flagged": bool(tx.is_flagged),
                "flag_reason": tx.flag_reason,
                "timestamp": tx.timestamp.isoformat() if tx.timestamp else None,
                "updated_at": tx.updated_at.isoformat() if tx.updated_at else None,
            }
            for tx in records
        ],
    }


@router.post("/{tx_hash}/assign", summary="Assign transaction case to analyst")
def assign_case(tx_hash: str, payload: AssignCaseRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    tx = db.query(Transaction).filter(Transaction.tx_hash == tx_hash).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    assigned_uuid = _parse_uuid(payload.assigned_to, "assigned_to")
    assigned_user = _load_user_if_present(db, assigned_uuid, "assigned_to")

    assigned_by_uuid = _parse_uuid(payload.assigned_by, "assigned_by")
    assigned_by_user = _load_user_if_present(db, assigned_by_uuid, "assigned_by")

    tx.assigned_to = assigned_uuid
    if not tx.case_status:
        tx.case_status = "PENDING"
    tx.updated_at = datetime.utcnow()

    db.add(
        TransactionCase(
            tx_hash=tx.tx_hash,
            analyst_id=assigned_uuid,
            action="ASSIGN",
            state=tx.case_status,
            note=payload.note,
        )
    )

    _write_audit_log(
        db=db,
        action_type="CASE_ASSIGN",
        tx_hash=tx.tx_hash,
        user_identifier=assigned_by_user.username if assigned_by_user else payload.assigned_by,
        details={
            "assigned_to": str(assigned_uuid) if assigned_uuid else None,
            "note": payload.note,
        },
    )

    db.commit()

    return {
        "message": "Case assigned",
        "tx_hash": tx.tx_hash,
        "status": tx.case_status,
        "assigned_to": str(tx.assigned_to) if tx.assigned_to else None,
    }


@router.post("/bulk-assign", summary="Bulk assign cases")
def bulk_assign_cases(payload: BulkAssignRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    if not payload.tx_hashes:
        raise HTTPException(status_code=400, detail="tx_hashes cannot be empty")

    assigned_uuid = _parse_uuid(payload.assigned_to, "assigned_to")
    assigned_user = _load_user_if_present(db, assigned_uuid, "assigned_to")

    assigned_by_uuid = _parse_uuid(payload.assigned_by, "assigned_by")
    assigned_by_user = _load_user_if_present(db, assigned_by_uuid, "assigned_by")

    updated_count = 0
    for tx_hash in payload.tx_hashes:
        tx = db.query(Transaction).filter(Transaction.tx_hash == tx_hash).first()
        if not tx:
            continue

        tx.assigned_to = assigned_uuid
        if not tx.case_status:
            tx.case_status = "PENDING"
        tx.updated_at = datetime.utcnow()

        db.add(
            TransactionCase(
                tx_hash=tx.tx_hash,
                analyst_id=assigned_uuid,
                action="ASSIGN",
                state=tx.case_status,
                note=payload.note,
            )
        )

        _write_audit_log(
            db=db,
            action_type="CASE_ASSIGN",
            tx_hash=tx.tx_hash,
            user_identifier=assigned_by_user.username if assigned_by_user else payload.assigned_by,
            details={
                "assigned_to": str(assigned_uuid) if assigned_uuid else None,
                "bulk": True,
                "note": payload.note,
            },
        )
        updated_count += 1

    db.commit()

    return {
        "message": "Bulk assignment completed",
        "requested": len(payload.tx_hashes),
        "updated": updated_count,
        "assigned_to": assigned_user.username if assigned_user else None,
    }


@router.post("/{tx_hash}/action", summary="Apply case action")
def apply_case_action(tx_hash: str, payload: CaseActionRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    tx = db.query(Transaction).filter(Transaction.tx_hash == tx_hash).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    action = payload.action.upper().strip()
    if action not in CASE_ACTIONS:
        raise HTTPException(status_code=400, detail="Invalid action")

    analyst_uuid = _parse_uuid(payload.analyst_id, "analyst_id")
    analyst_user = _load_user_if_present(db, analyst_uuid, "analyst_id")

    current_status = (tx.case_status or "PENDING").upper()
    target_status = current_status

    if action == "CONFIRM_FRAUD":
        target_status = "FRAUD"
    elif action == "DISMISS":
        target_status = "IGNORED"
    elif action == "ESCALATE":
        target_status = "VERIFIED" if current_status == "PENDING" else current_status

    _validate_transition(current_status, target_status)

    tx.case_status = target_status
    tx.updated_at = datetime.utcnow()
    if analyst_uuid:
        tx.assigned_to = analyst_uuid

    db.add(
        TransactionCase(
            tx_hash=tx.tx_hash,
            analyst_id=analyst_uuid,
            action=action,
            state=target_status,
            note=payload.note,
        )
    )

    _write_audit_log(
        db=db,
        action_type=f"CASE_{action}",
        tx_hash=tx.tx_hash,
        user_identifier=analyst_user.username if analyst_user else payload.analyst_id,
        details={
            "previous_status": current_status,
            "new_status": target_status,
            "note": payload.note,
        },
    )

    db.commit()

    return {
        "message": "Case action applied",
        "tx_hash": tx.tx_hash,
        "action": action,
        "previous_status": current_status,
        "new_status": target_status,
        "assigned_to": str(tx.assigned_to) if tx.assigned_to else None,
    }


@router.get("/{tx_hash}/history", summary="Get case history")
def get_case_history(tx_hash: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    tx = db.query(Transaction).filter(Transaction.tx_hash == tx_hash).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    history = (
        db.query(TransactionCase)
        .filter(TransactionCase.tx_hash == tx_hash)
        .order_by(TransactionCase.created_at.desc())
        .all()
    )

    return {
        "tx_hash": tx_hash,
        "status": tx.case_status,
        "assigned_to": str(tx.assigned_to) if tx.assigned_to else None,
        "history": [
            {
                "id": str(entry.id),
                "action": entry.action,
                "state": entry.state,
                "analyst_id": str(entry.analyst_id) if entry.analyst_id else None,
                "note": entry.note,
                "created_at": entry.created_at.isoformat() if entry.created_at else None,
            }
            for entry in history
        ],
    }
