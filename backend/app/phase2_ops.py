"""Phase 2 operational APIs: system admin and AI/data engineer modules."""

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import (
    Alert,
    AuditLog,
    BlockedTransfer,
    DiagnosticEvent,
    FeatureStoreConfig,
    ModelRegistry,
    NodeEndpoint,
    PipelineMetric,
    PolicyRule,
    Transaction,
    User,
)
from app.utils.api_response import api_success

router = APIRouter(prefix="/ops", tags=["Phase 2 Operations"])


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


class NodeEndpointCreate(BaseModel):
    provider_name: str
    chain: str
    endpoint_url: str
    protocol: str = Field(default="http", description="http | websocket")
    priority: int = 100
    is_active: bool = True


class NodeEndpointHealthUpdate(BaseModel):
    health_status: str = Field(description="healthy | degraded | down | unknown")
    last_error: Optional[str] = None


class PipelineMetricCreate(BaseModel):
    chain: str
    block_number: Optional[int] = None
    throughput_tps: Optional[float] = None
    ingestion_latency_ms: Optional[int] = None
    decode_latency_ms: Optional[int] = None


class FeatureConfigCreate(BaseModel):
    feature_key: str
    enabled: bool = True
    expression: Optional[str] = None
    owner_user_id: Optional[str] = None


class FeatureConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    expression: Optional[str] = None


class ModelRegistryCreate(BaseModel):
    model_name: str
    version: str
    artifact_uri: str
    framework: str = Field(default="pkl", description="pkl | onnx | pt")
    is_active: bool = False
    promoted_by: Optional[str] = None


class ModelActivateRequest(BaseModel):
    promoted_by: Optional[str] = None


@router.get("/system/node-endpoints")
def list_node_endpoints(
    chain: Optional[str] = Query(default=None),
    only_active: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    query = db.query(NodeEndpoint)

    if chain:
        query = query.filter(NodeEndpoint.chain == chain)
    if only_active:
        query = query.filter(NodeEndpoint.is_active.is_(True))

    records = query.order_by(NodeEndpoint.priority.asc(), NodeEndpoint.created_at.asc()).all()

    response = {
        "count": len(records),
        "items": [
            {
                "id": str(item.id),
                "provider_name": item.provider_name,
                "chain": item.chain,
                "endpoint_url": item.endpoint_url,
                "protocol": item.protocol,
                "priority": item.priority,
                "is_active": bool(item.is_active),
                "health_status": item.health_status,
                "last_error": item.last_error,
                "last_checked_at": item.last_checked_at.isoformat() if item.last_checked_at else None,
            }
            for item in records
        ],
    }
    return api_success(data=response, message="Node endpoints fetched", meta={"count": len(records)}, legacy=response)


@router.post("/system/node-endpoints")
def create_node_endpoint(payload: NodeEndpointCreate, db: Session = Depends(get_db)) -> Dict[str, Any]:
    protocol = payload.protocol.lower().strip()
    if protocol not in {"http", "websocket"}:
        raise HTTPException(status_code=400, detail="protocol must be http or websocket")

    endpoint = NodeEndpoint(
        provider_name=payload.provider_name,
        chain=payload.chain,
        endpoint_url=payload.endpoint_url,
        protocol=protocol,
        priority=payload.priority,
        is_active=payload.is_active,
        health_status="unknown",
    )
    db.add(endpoint)

    _audit(
        db,
        action="NODE_ENDPOINT_CREATE",
        entity_type="node_endpoint",
        details={
            "provider_name": payload.provider_name,
            "chain": payload.chain,
            "protocol": protocol,
            "priority": payload.priority,
        },
    )

    db.commit()
    db.refresh(endpoint)

    return {
        "message": "Node endpoint created",
        "id": str(endpoint.id),
    }


@router.put("/system/node-endpoints/{endpoint_id}/health")
def update_node_endpoint_health(endpoint_id: str, payload: NodeEndpointHealthUpdate, db: Session = Depends(get_db)) -> Dict[str, Any]:
    endpoint_uuid = _parse_uuid(endpoint_id, "endpoint_id")
    endpoint = db.query(NodeEndpoint).filter(NodeEndpoint.id == endpoint_uuid).first()
    if not endpoint:
        raise HTTPException(status_code=404, detail="Node endpoint not found")

    status_norm = payload.health_status.lower().strip()
    if status_norm not in {"healthy", "degraded", "down", "unknown"}:
        raise HTTPException(status_code=400, detail="Invalid health_status")

    endpoint.health_status = status_norm
    endpoint.last_error = payload.last_error
    endpoint.last_checked_at = datetime.utcnow()

    _audit(
        db,
        action="NODE_ENDPOINT_HEALTH_UPDATE",
        entity_type="node_endpoint",
        details={
            "endpoint_id": str(endpoint.id),
            "health_status": endpoint.health_status,
            "last_error": payload.last_error,
        },
    )

    db.commit()

    return {
        "message": "Health status updated",
        "endpoint_id": str(endpoint.id),
        "health_status": endpoint.health_status,
    }


@router.get("/system/pipeline-metrics")
def list_pipeline_metrics(
    chain: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    query = db.query(PipelineMetric)

    if chain:
        query = query.filter(PipelineMetric.chain == chain)

    records = query.order_by(PipelineMetric.inserted_at.desc()).limit(limit).all()

    response = {
        "count": len(records),
        "items": [
            {
                "id": int(item.id),
                "chain": item.chain,
                "block_number": int(item.block_number) if item.block_number is not None else None,
                "throughput_tps": float(item.throughput_tps) if item.throughput_tps is not None else None,
                "ingestion_latency_ms": item.ingestion_latency_ms,
                "decode_latency_ms": item.decode_latency_ms,
                "inserted_at": item.inserted_at.isoformat() if item.inserted_at else None,
            }
            for item in records
        ],
    }
    return api_success(data=response, message="Pipeline metrics fetched", meta={"count": len(records)}, legacy=response)


@router.post("/system/pipeline-metrics")
def create_pipeline_metric(payload: PipelineMetricCreate, db: Session = Depends(get_db)) -> Dict[str, Any]:
    metric = PipelineMetric(
        chain=payload.chain,
        block_number=payload.block_number,
        throughput_tps=Decimal(str(payload.throughput_tps)) if payload.throughput_tps is not None else None,
        ingestion_latency_ms=payload.ingestion_latency_ms,
        decode_latency_ms=payload.decode_latency_ms,
    )
    db.add(metric)

    _audit(
        db,
        action="PIPELINE_METRIC_CREATE",
        entity_type="pipeline_metric",
        details={
            "chain": payload.chain,
            "block_number": payload.block_number,
            "throughput_tps": payload.throughput_tps,
            "ingestion_latency_ms": payload.ingestion_latency_ms,
            "decode_latency_ms": payload.decode_latency_ms,
        },
    )

    db.commit()
    db.refresh(metric)

    return {"message": "Metric inserted", "id": int(metric.id)}


@router.get("/system/pipeline-metrics/summary")
def get_pipeline_metrics_summary(chain: Optional[str] = Query(default=None), db: Session = Depends(get_db)) -> Dict[str, Any]:
    base_query = db.query(PipelineMetric)
    if chain:
        base_query = base_query.filter(PipelineMetric.chain == chain)

    avg_tps = base_query.with_entities(func.avg(PipelineMetric.throughput_tps)).scalar()
    avg_ingest = base_query.with_entities(func.avg(PipelineMetric.ingestion_latency_ms)).scalar()
    avg_decode = base_query.with_entities(func.avg(PipelineMetric.decode_latency_ms)).scalar()
    last_block = base_query.with_entities(func.max(PipelineMetric.block_number)).scalar()
    total_points = base_query.count()

    response = {
        "chain": chain,
        "total_points": total_points,
        "avg_throughput_tps": float(avg_tps) if avg_tps is not None else None,
        "avg_ingestion_latency_ms": float(avg_ingest) if avg_ingest is not None else None,
        "avg_decode_latency_ms": float(avg_decode) if avg_decode is not None else None,
        "last_block_number": int(last_block) if last_block is not None else None,
    }
    return api_success(data=response, message="Pipeline summary fetched", legacy=response)


@router.get("/ai/feature-store")
def list_feature_configs(only_enabled: bool = Query(default=False), db: Session = Depends(get_db)) -> Dict[str, Any]:
    query = db.query(FeatureStoreConfig)
    if only_enabled:
        query = query.filter(FeatureStoreConfig.enabled.is_(True))

    records = query.order_by(FeatureStoreConfig.feature_key.asc()).all()
    response = {
        "count": len(records),
        "items": [
            {
                "id": str(item.id),
                "feature_key": item.feature_key,
                "enabled": bool(item.enabled),
                "expression": item.expression,
                "owner_user_id": str(item.owner_user_id) if item.owner_user_id else None,
                "updated_at": item.updated_at.isoformat() if item.updated_at else None,
            }
            for item in records
        ],
    }
    return api_success(data=response, message="Feature configs fetched", meta={"count": len(records)}, legacy=response)


@router.post("/ai/feature-store")
def create_feature_config(payload: FeatureConfigCreate, db: Session = Depends(get_db)) -> Dict[str, Any]:
    existing = db.query(FeatureStoreConfig).filter(FeatureStoreConfig.feature_key == payload.feature_key).first()
    if existing:
        raise HTTPException(status_code=409, detail="feature_key already exists")

    owner_uuid = _parse_uuid(payload.owner_user_id, "owner_user_id")
    _load_user_if_present(db, owner_uuid, "owner_user_id")

    item = FeatureStoreConfig(
        feature_key=payload.feature_key,
        enabled=payload.enabled,
        expression=payload.expression,
        owner_user_id=owner_uuid,
    )
    db.add(item)

    _audit(
        db,
        action="FEATURE_CREATE",
        entity_type="feature_store_config",
        details={
            "feature_key": payload.feature_key,
            "enabled": payload.enabled,
        },
    )

    db.commit()
    db.refresh(item)

    return {"message": "Feature created", "id": str(item.id)}


@router.put("/ai/feature-store/{feature_id}")
def update_feature_config(feature_id: str, payload: FeatureConfigUpdate, db: Session = Depends(get_db)) -> Dict[str, Any]:
    feature_uuid = _parse_uuid(feature_id, "feature_id")
    item = db.query(FeatureStoreConfig).filter(FeatureStoreConfig.id == feature_uuid).first()
    if not item:
        raise HTTPException(status_code=404, detail="Feature config not found")

    if payload.enabled is not None:
        item.enabled = payload.enabled
    if payload.expression is not None:
        item.expression = payload.expression

    _audit(
        db,
        action="FEATURE_UPDATE",
        entity_type="feature_store_config",
        details={
            "feature_id": str(item.id),
            "enabled": item.enabled,
        },
    )

    db.commit()

    return {"message": "Feature updated", "id": str(item.id)}


@router.get("/ai/model-registry")
def list_model_registry(model_name: Optional[str] = Query(default=None), db: Session = Depends(get_db)) -> Dict[str, Any]:
    query = db.query(ModelRegistry)
    if model_name:
        query = query.filter(ModelRegistry.model_name == model_name)

    records = query.order_by(ModelRegistry.created_at.desc()).all()

    response = {
        "count": len(records),
        "items": [
            {
                "id": str(item.id),
                "model_name": item.model_name,
                "version": item.version,
                "artifact_uri": item.artifact_uri,
                "framework": item.framework,
                "is_active": bool(item.is_active),
                "promoted_by": str(item.promoted_by) if item.promoted_by else None,
                "promoted_at": item.promoted_at.isoformat() if item.promoted_at else None,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in records
        ],
    }
    return api_success(data=response, message="Model registry fetched", meta={"count": len(records)}, legacy=response)


@router.post("/ai/model-registry")
def create_model_registry(payload: ModelRegistryCreate, db: Session = Depends(get_db)) -> Dict[str, Any]:
    framework = payload.framework.lower().strip()
    if framework not in {"pkl", "onnx", "pt"}:
        raise HTTPException(status_code=400, detail="framework must be pkl, onnx, or pt")

    promoter_uuid = _parse_uuid(payload.promoted_by, "promoted_by")
    promoter = _load_user_if_present(db, promoter_uuid, "promoted_by")

    if payload.is_active:
        db.query(ModelRegistry).filter(ModelRegistry.model_name == payload.model_name).update(
            {ModelRegistry.is_active: False}, synchronize_session=False
        )

    record = ModelRegistry(
        model_name=payload.model_name,
        version=payload.version,
        artifact_uri=payload.artifact_uri,
        framework=framework,
        is_active=payload.is_active,
        promoted_by=promoter_uuid,
        promoted_at=datetime.utcnow() if payload.is_active else None,
    )
    db.add(record)

    _audit(
        db,
        action="MODEL_CREATE",
        entity_type="model_registry",
        user_identifier=promoter.username if promoter else None,
        details={
            "model_name": payload.model_name,
            "version": payload.version,
            "framework": framework,
            "is_active": payload.is_active,
        },
    )

    db.commit()
    db.refresh(record)

    return {"message": "Model entry created", "id": str(record.id)}


@router.put("/ai/model-registry/{model_id}/activate")
def activate_model(model_id: str, payload: ModelActivateRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    model_uuid = _parse_uuid(model_id, "model_id")
    model = db.query(ModelRegistry).filter(ModelRegistry.id == model_uuid).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model entry not found")

    promoter_uuid = _parse_uuid(payload.promoted_by, "promoted_by")
    promoter = _load_user_if_present(db, promoter_uuid, "promoted_by")

    db.query(ModelRegistry).filter(ModelRegistry.model_name == model.model_name).update(
        {ModelRegistry.is_active: False}, synchronize_session=False
    )

    model.is_active = True
    model.promoted_by = promoter_uuid
    model.promoted_at = datetime.utcnow()

    _audit(
        db,
        action="MODEL_ACTIVATE",
        entity_type="model_registry",
        user_identifier=promoter.username if promoter else None,
        details={
            "model_id": str(model.id),
            "model_name": model.model_name,
            "version": model.version,
        },
    )

    db.commit()

    return {
        "message": "Model activated",
        "id": str(model.id),
        "model_name": model.model_name,
        "version": model.version,
    }


@router.get("/ai/model-registry/active")
def get_active_models(db: Session = Depends(get_db)) -> Dict[str, Any]:
    records = db.query(ModelRegistry).filter(ModelRegistry.is_active.is_(True)).order_by(ModelRegistry.model_name.asc()).all()

    response = {
        "count": len(records),
        "items": [
            {
                "id": str(item.id),
                "model_name": item.model_name,
                "version": item.version,
                "framework": item.framework,
                "artifact_uri": item.artifact_uri,
                "promoted_at": item.promoted_at.isoformat() if item.promoted_at else None,
            }
            for item in records
        ],
    }
    return api_success(data=response, message="Active models fetched", meta={"count": len(records)}, legacy=response)


@router.get("/system/data-integrity")
def get_system_data_integrity(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Report DB-backed readiness and missing controls/models for all role panels."""
    counts = {
        "wallets": int(db.query(func.count(Transaction.from_address.distinct())).scalar() or 0),
        "transactions": int(db.query(func.count(Transaction.id)).scalar() or 0),
        "alerts": int(db.query(func.count(Alert.id)).scalar() or 0),
        "blocked_transfers": int(db.query(func.count(BlockedTransfer.id)).scalar() or 0),
        "node_endpoints": int(db.query(func.count(NodeEndpoint.id)).scalar() or 0),
        "pipeline_metrics": int(db.query(func.count(PipelineMetric.id)).scalar() or 0),
        "feature_configs": int(db.query(func.count(FeatureStoreConfig.id)).scalar() or 0),
        "model_registry": int(db.query(func.count(ModelRegistry.id)).scalar() or 0),
        "active_models": int(db.query(func.count(ModelRegistry.id)).filter(ModelRegistry.is_active.is_(True)).scalar() or 0),
        "policy_rules": int(db.query(func.count(PolicyRule.id)).scalar() or 0),
        "active_policy_rules": int(db.query(func.count(PolicyRule.id)).filter(PolicyRule.is_active.is_(True)).scalar() or 0),
        "audit_logs": int(db.query(func.count(AuditLog.id)).scalar() or 0),
        "diagnostic_events": int(db.query(func.count(DiagnosticEvent.id)).scalar() or 0),
    }

    checks = [
        {"key": "system.node_endpoints", "ok": counts["node_endpoints"] > 0, "required_min": 1, "actual": counts["node_endpoints"], "owner_role": "system_admin"},
        {"key": "system.pipeline_metrics", "ok": counts["pipeline_metrics"] > 0, "required_min": 1, "actual": counts["pipeline_metrics"], "owner_role": "system_admin"},
        {"key": "system.diagnostic_events", "ok": counts["diagnostic_events"] > 0, "required_min": 1, "actual": counts["diagnostic_events"], "owner_role": "system_admin"},
        {"key": "ai.feature_configs", "ok": counts["feature_configs"] > 0, "required_min": 1, "actual": counts["feature_configs"], "owner_role": "ai_data_engineer"},
        {"key": "ai.model_registry", "ok": counts["model_registry"] > 0, "required_min": 1, "actual": counts["model_registry"], "owner_role": "ai_data_engineer"},
        {"key": "ai.active_models", "ok": counts["active_models"] > 0, "required_min": 1, "actual": counts["active_models"], "owner_role": "ai_data_engineer"},
        {"key": "security.alerts", "ok": counts["alerts"] > 0, "required_min": 1, "actual": counts["alerts"], "owner_role": "security_analyst"},
        {"key": "security.transactions", "ok": counts["transactions"] > 0, "required_min": 1, "actual": counts["transactions"], "owner_role": "security_analyst"},
        {"key": "security.blocked_transfers", "ok": counts["blocked_transfers"] > 0, "required_min": 1, "actual": counts["blocked_transfers"], "owner_role": "security_analyst"},
        {"key": "compliance.policy_rules", "ok": counts["policy_rules"] > 0, "required_min": 1, "actual": counts["policy_rules"], "owner_role": "compliance_risk_manager"},
        {"key": "compliance.active_policy_rules", "ok": counts["active_policy_rules"] > 0, "required_min": 1, "actual": counts["active_policy_rules"], "owner_role": "compliance_risk_manager"},
        {"key": "compliance.audit_logs", "ok": counts["audit_logs"] > 0, "required_min": 1, "actual": counts["audit_logs"], "owner_role": "compliance_risk_manager"},
    ]

    missing = [
        {
            "key": item["key"],
            "owner_role": item["owner_role"],
            "required_min": item["required_min"],
            "actual": item["actual"],
            "severity": "high" if item["key"].endswith("active_models") or item["key"].endswith("active_policy_rules") else "medium",
            "recommended_next_step": f"Seed or create records for {item['key']} to enable corresponding role panels",
        }
        for item in checks
        if not item["ok"]
    ]

    role_readiness = {
        "system_admin": all(item["ok"] for item in checks if item["owner_role"] == "system_admin"),
        "ai_data_engineer": all(item["ok"] for item in checks if item["owner_role"] == "ai_data_engineer"),
        "security_analyst": all(item["ok"] for item in checks if item["owner_role"] == "security_analyst"),
        "compliance_risk_manager": all(item["ok"] for item in checks if item["owner_role"] == "compliance_risk_manager"),
    }

    response = {
        "overall_ok": len(missing) == 0,
        "counts": counts,
        "checks": checks,
        "missing_controls": missing,
        "role_readiness": role_readiness,
    }
    return api_success(data=response, message="Data integrity report generated", meta={"missing_count": len(missing)}, legacy=response)
