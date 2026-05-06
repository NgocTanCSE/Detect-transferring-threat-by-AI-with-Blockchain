"""Phase 3 governance APIs: policy rules, security summaries, and notification adapters."""

import logging
from datetime import datetime
from typing import Any, Dict, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import (
    Alert,
    AuditLog,
    NotificationEvent,
    PolicyRule,
    Transaction,
    User,
)
from app.admin_diagnostics import log_diagnostic, DiagnosticLogType
from app.utils.api_response import api_success
from app.utils.auth_utils import get_org_id

router = APIRouter(prefix="/ops", tags=["Phase 3 Governance"])
logger = logging.getLogger(__name__)


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


def _audit(db: Session, action: str, entity_type: str, details: Dict[str, Any], user_identifier: Optional[str] = None) -> None:
    db.add(
        AuditLog(
            action_type=action,
            entity_type=entity_type,
            user_identifier=user_identifier,
            details=details,
        )
    )


class PolicyRuleCreate(BaseModel):
    rule_name: str
    description: Optional[str] = None
    min_risk_score: float = Field(default=80.0, ge=0, le=100)
    block_blacklisted: bool = True
    block_suspended: bool = True
    notify_on_block: bool = True
    priority: int = 100
    is_active: bool = True
    created_by: Optional[str] = None


class PolicyRuleUpdate(BaseModel):
    description: Optional[str] = None
    min_risk_score: Optional[float] = Field(default=None, ge=0, le=100)
    block_blacklisted: Optional[bool] = None
    block_suspended: Optional[bool] = None
    notify_on_block: Optional[bool] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


class PolicyEvaluateRequest(BaseModel):
    risk_score: float = Field(ge=0, le=100)
    account_status: str = "active"
    is_blacklisted: bool = False


class NotificationSendRequest(BaseModel):
    channel: str = Field(description="slack | telegram | email | webhook")
    recipient: str
    severity: str = "MEDIUM"
    message: str
    metadata: Optional[Dict[str, Any]] = None


def list_policy_rules(
    only_active: bool = Query(default=False),
    db: Session = Depends(get_db),
    org_id: str | None = Depends(get_org_id)
) -> Dict[str, Any]:
    try:
        query = db.query(PolicyRule)
        if org_id:
            query = query.filter(PolicyRule.organization_id == org_id)
        if only_active:
            query = query.filter(PolicyRule.is_active.is_(True))

        records = query.order_by(PolicyRule.priority.asc(), PolicyRule.created_at.asc()).all()

        response = {
            "count": len(records),
            "items": [
                {
                    "id": str(item.id),
                    "rule_name": item.rule_name,
                    "description": item.description,
                    "min_risk_score": float(item.min_risk_score),
                    "block_blacklisted": bool(item.block_blacklisted),
                    "block_suspended": bool(item.block_suspended),
                    "notify_on_block": bool(item.notify_on_block),
                    "priority": int(item.priority),
                    "is_active": bool(item.is_active),
                    "created_by": str(item.created_by) if item.created_by else None,
                    "created_at": item.created_at.isoformat() if item.created_at else None,
                    "updated_at": item.updated_at.isoformat() if item.updated_at else None,
                }
                for item in records
            ],
        }

        log_diagnostic(
            DiagnosticLogType.API_CALL,
            f"Policy rules fetched: {response['count']} items",
            status_code=200,
            endpoint="/ops/compliance/policy-rules"
        )
        return api_success(data=response, message="Policy rules fetched", meta={"count": response["count"]}, legacy=response)
    except Exception as e:
        logger.exception(f"Failed to list policy rules: {e}")
        log_diagnostic(
            DiagnosticLogType.API_ERROR,
            f"Failed to list policy rules: {str(e)}",
            details={"error_type": type(e).__name__},
            status_code=500,
            endpoint="/ops/compliance/policy-rules"
        )
        raise HTTPException(status_code=500, detail=f"Failed to list policy rules: {str(e)}")


@router.post("/compliance/policy-rules")
def create_policy_rule(payload: PolicyRuleCreate, db: Session = Depends(get_db)) -> Dict[str, Any]:
    existing = db.query(PolicyRule).filter(PolicyRule.rule_name == payload.rule_name).first()
    if existing:
        raise HTTPException(status_code=409, detail="rule_name already exists")

    creator_uuid = _parse_uuid(payload.created_by, "created_by")
    creator = _load_user_if_present(db, creator_uuid, "created_by")

    item = PolicyRule(
        rule_name=payload.rule_name,
        description=payload.description,
        min_risk_score=payload.min_risk_score,
        block_blacklisted=payload.block_blacklisted,
        block_suspended=payload.block_suspended,
        notify_on_block=payload.notify_on_block,
        priority=payload.priority,
        is_active=payload.is_active,
        created_by=creator_uuid,
        organization_id=org_id
    )
    db.add(item)

    _audit(
        db,
        action="POLICY_RULE_CREATE",
        entity_type="policy_rule",
        user_identifier=creator.username if creator else None,
        details={
            "rule_name": payload.rule_name,
            "min_risk_score": payload.min_risk_score,
            "is_active": payload.is_active,
        },
    )

    db.commit()
    db.refresh(item)

    return {"message": "Policy rule created", "id": str(item.id)}


@router.put("/compliance/policy-rules/{rule_id}")
def update_policy_rule(rule_id: str, payload: PolicyRuleUpdate, db: Session = Depends(get_db)) -> Dict[str, Any]:
    rule_uuid = _parse_uuid(rule_id, "rule_id")
    item = db.query(PolicyRule).filter(PolicyRule.id == rule_uuid).first()
    if not item:
        raise HTTPException(status_code=404, detail="Policy rule not found")

    if payload.description is not None:
        item.description = payload.description
    if payload.min_risk_score is not None:
        item.min_risk_score = payload.min_risk_score
    if payload.block_blacklisted is not None:
        item.block_blacklisted = payload.block_blacklisted
    if payload.block_suspended is not None:
        item.block_suspended = payload.block_suspended
    if payload.notify_on_block is not None:
        item.notify_on_block = payload.notify_on_block
    if payload.priority is not None:
        item.priority = payload.priority
    if payload.is_active is not None:
        item.is_active = payload.is_active

    _audit(
        db,
        action="POLICY_RULE_UPDATE",
        entity_type="policy_rule",
        details={
            "rule_id": str(item.id),
            "rule_name": item.rule_name,
            "is_active": item.is_active,
            "priority": item.priority,
        },
    )

    db.commit()

    return {"message": "Policy rule updated", "id": str(item.id)}


@router.delete("/compliance/policy-rules/{rule_id}")
def delete_policy_rule(rule_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    rule_uuid = _parse_uuid(rule_id, "rule_id")
    item = db.query(PolicyRule).filter(PolicyRule.id == rule_uuid).first()
    if not item:
        raise HTTPException(status_code=404, detail="Policy rule not found")

    rule_name = item.rule_name

    _audit(
        db,
        action="POLICY_RULE_DELETE",
        entity_type="policy_rule",
        details={
            "rule_id": str(item.id),
            "rule_name": rule_name,
        },
    )

    db.delete(item)
    db.commit()

    return {"message": "Policy rule deleted", "id": str(rule_uuid), "rule_name": rule_name}


@router.post("/compliance/policy-evaluate")
def evaluate_policy(payload: PolicyEvaluateRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    active_rules = (
        db.query(PolicyRule)
        .filter(PolicyRule.is_active.is_(True))
        .order_by(PolicyRule.priority.asc())
        .all()
    )

    matched_rules = []
    blocked = False

    for rule in active_rules:
        reasons = []
        if payload.risk_score >= float(rule.min_risk_score):
            reasons.append("risk")
        if payload.is_blacklisted and rule.block_blacklisted:
            reasons.append("blacklist")
        if payload.account_status in {"suspended", "frozen"} and rule.block_suspended:
            reasons.append("status")

        if reasons:
            matched_rules.append(
                {
                    "rule_id": str(rule.id),
                    "rule_name": rule.rule_name,
                    "reasons": reasons,
                    "notify_on_block": bool(rule.notify_on_block),
                }
            )
            blocked = True

    return {
        "decision": "BLOCK" if blocked else "ALLOW",
        "matched_count": len(matched_rules),
        "matched_rules": matched_rules,
        "input": {
            "risk_score": payload.risk_score,
            "account_status": payload.account_status,
            "is_blacklisted": payload.is_blacklisted,
        },
    }


@router.get("/security/case-summary")
def get_case_summary(db: Session = Depends(get_db), org_id: str | None = Depends(get_org_id)) -> Dict[str, Any]:
    try:
        query = db.query(Transaction.case_status, func.count(Transaction.tx_hash))
        if org_id:
            query = query.filter(Transaction.organization_id == org_id)
        totals = dict(query.group_by(Transaction.case_status).all())

        unassigned_query = db.query(func.count(Transaction.tx_hash)).filter(Transaction.assigned_to.is_(None))
        if org_id:
            unassigned_query = unassigned_query.filter(Transaction.organization_id == org_id)
        unassigned = unassigned_query.scalar() or 0

        high_risk_query = db.query(func.count(Transaction.tx_hash)).filter(Transaction.assigned_to.is_(None), Transaction.normalized_risk_score >= 0.8)
        if org_id:
            high_risk_query = high_risk_query.filter(Transaction.organization_id == org_id)
        high_risk_unassigned = high_risk_query.scalar() or 0

        response = {
            "totals": {
                "PENDING": int(totals.get("PENDING", 0)),
                "VERIFIED": int(totals.get("VERIFIED", 0)),
                "FRAUD": int(totals.get("FRAUD", 0)),
                "IGNORED": int(totals.get("IGNORED", 0)),
            },
            "unassigned": int(unassigned),
            "high_risk_unassigned": int(high_risk_unassigned),
        }

        log_diagnostic(
            DiagnosticLogType.API_CALL,
            f"Case summary: {int(unassigned)} unassigned, {int(high_risk_unassigned)} high-risk unassigned",
            status_code=200,
            endpoint="/ops/security/case-summary"
        )
        return api_success(data=response, message="Case summary fetched", legacy=response)
    except Exception as e:
        logger.exception(f"Failed to get case summary: {e}")
        log_diagnostic(
            DiagnosticLogType.API_ERROR,
            f"Failed to get case summary: {str(e)}",
            details={"error_type": type(e).__name__},
            status_code=500,
            endpoint="/ops/security/case-summary"
        )
        raise HTTPException(status_code=500, detail=f"Failed to get case summary: {str(e)}")


@router.post("/security/notifications/test")
def send_test_notification(payload: NotificationSendRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    channel = payload.channel.lower().strip()
    if channel not in {"slack", "telegram", "email", "webhook"}:
        raise HTTPException(status_code=400, detail="Invalid channel")

    severity = payload.severity.upper().strip()
    if severity not in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}:
        raise HTTPException(status_code=400, detail="Invalid severity")

    event = NotificationEvent(
        channel=channel,
        recipient=payload.recipient,
        severity=severity,
        message=payload.message,
        status="sent",
        meta=payload.metadata,
        sent_at=datetime.utcnow(),
    )
    db.add(event)

    _audit(
        db,
        action="NOTIFICATION_TEST_SEND",
        entity_type="notification_event",
        details={
            "channel": channel,
            "recipient": payload.recipient,
            "severity": severity,
        },
    )

    db.commit()
    db.refresh(event)

    return {
        "message": "Test notification logged",
        "id": str(event.id),
        "status": event.status,
    }


@router.get("/security/notifications")
def list_notification_events(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    records = db.query(NotificationEvent).order_by(NotificationEvent.created_at.desc()).limit(limit).all()

    response = {
        "count": len(records),
        "items": [
            {
                "id": str(item.id),
                "channel": item.channel,
                "recipient": item.recipient,
                "severity": item.severity,
                "message": item.message,
                "status": item.status,
                "metadata": item.meta,
                "created_at": item.created_at.isoformat() if item.created_at else None,
                "sent_at": item.sent_at.isoformat() if item.sent_at else None,
            }
            for item in records
        ],
    }
    return api_success(data=response, message="Notification events fetched", meta={"count": len(records)}, legacy=response)


@router.get("/security/alerts-summary")
def get_alerts_summary(db: Session = Depends(get_db), org_id: str | None = Depends(get_org_id)) -> Dict[str, Any]:
    try:
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

        alerts_query = db.query(Alert.severity, func.count(Alert.id))
        if org_id:
            alerts_query = alerts_query.filter(Alert.organization_id == org_id)
        by_severity = dict(alerts_query.group_by(Alert.severity).all())

        today_query = db.query(func.count(Alert.id)).filter(Alert.detected_at >= today_start)
        if org_id:
            today_query = today_query.filter(Alert.organization_id == org_id)
        
        response = {
            "today": int(today_query.scalar() or 0),
            "critical": int(by_severity.get("CRITICAL", 0)),
            "high": int(by_severity.get("HIGH", 0)),
            "medium": int(by_severity.get("MEDIUM", 0)),
            "low": int(by_severity.get("LOW", 0)),
        }

        log_diagnostic(
            DiagnosticLogType.API_CALL,
            f"Alerts summary: {response.get('critical', 0)} critical, {response.get('today', 0)} today",
            status_code=200,
            endpoint="/ops/security/alerts-summary"
        )
        return api_success(data=response, message="Alerts summary fetched", legacy=response)
    except Exception as e:
        logger.exception(f"Failed to get alerts summary: {e}")
        log_diagnostic(
            DiagnosticLogType.API_ERROR,
            f"Failed to get alerts summary: {str(e)}",
            details={"error_type": type(e).__name__},
            status_code=500,
            endpoint="/ops/security/alerts-summary"
        )
        raise HTTPException(status_code=500, detail=f"Failed to get alerts summary: {str(e)}")
