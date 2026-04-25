from fastapi import FastAPI, Query, HTTPException
from sqlalchemy import text, create_engine
from datetime import datetime, timedelta, timezone
import os
import csv
from io import StringIO
from typing import Dict, Any, List

app = FastAPI(title="Analytics Service")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://blockchain:blockchain123@postgres_main:5432/blockchain_main")
engine = create_engine(DATABASE_URL)

def _window_start(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)

def _to_eth(value_wei: Any) -> float:
    if value_wei is None:
        return 0.0
    return float(value_wei) / 10**18

@app.get("/health")
def health():
    return {"status": "ok", "service": "analytics-service"}

@app.get("/compliance/reporting/summary")
def compliance_reporting_summary(days: int = Query(default=30, ge=1, le=365)):
    period_start = _window_start(days)
    
    with engine.connect() as conn:
        # Alerts
        alerts_total = conn.execute(text("SELECT COUNT(*) FROM alerts WHERE detected_at >= :start"), {"start": period_start}).scalar()
        critical_alerts = conn.execute(text("SELECT COUNT(*) FROM alerts WHERE detected_at >= :start AND severity = 'CRITICAL'"), {"start": period_start}).scalar()
        
        # Blocked
        blocked_total = conn.execute(text("SELECT COUNT(*) FROM blocked_transfers WHERE blocked_at >= :start"), {"start": period_start}).scalar()
        blocked_value_wei = conn.execute(text("SELECT COALESCE(SUM(amount), 0) FROM blocked_transfers WHERE blocked_at >= :start"), {"start": period_start}).scalar()
        
        # Cases
        cases_rows = conn.execute(text("SELECT case_status, COUNT(*) FROM transactions WHERE updated_at >= :start GROUP BY case_status"), {"start": period_start}).fetchall()
        cases_by_state = {row[0]: row[1] for row in cases_rows}
        
        # Notifications
        notif_sent = conn.execute(text("SELECT COUNT(*) FROM notification_events WHERE created_at >= :start AND status = 'sent'"), {"start": period_start}).scalar()
        notif_failed = conn.execute(text("SELECT COUNT(*) FROM notification_events WHERE created_at >= :start AND status = 'failed'"), {"start": period_start}).scalar()
        
        # Policies
        policy_active = conn.execute(text("SELECT COUNT(*) FROM policy_rules WHERE is_active = true")).scalar()
        
        # Audit
        audit_count = conn.execute(text("SELECT COUNT(*) FROM audit_logs WHERE timestamp >= :start"), {"start": period_start}).scalar()

    return {
        "period": {
            "days": days,
            "start": period_start.isoformat(),
            "end": datetime.now(timezone.utc).isoformat(),
        },
        "kpis": {
            "alerts_total": int(alerts_total or 0),
            "critical_alerts": int(critical_alerts or 0),
            "blocked_total": int(blocked_total or 0),
            "blocked_value_eth": _to_eth(blocked_value_wei),
            "policy_rules_active": int(policy_active or 0),
            "notifications_sent": int(notif_sent or 0),
            "notifications_failed": int(notif_failed or 0),
            "audit_events": int(audit_count or 0),
        },
        "cases": {
            "PENDING": int(cases_by_state.get("PENDING", 0)),
            "VERIFIED": int(cases_by_state.get("VERIFIED", 0)),
            "FRAUD": int(cases_by_state.get("FRAUD", 0)),
            "IGNORED": int(cases_by_state.get("IGNORED", 0)),
        },
    }

@app.get("/system/slo-metrics")
def system_slo_metrics(days: int = Query(default=7, ge=1, le=90)):
    period_start = _window_start(days)
    
    with engine.connect() as conn:
        # Endpoint health
        endpoints = conn.execute(text("SELECT is_active, health_status FROM node_endpoints")).fetchall()
        active_endpoints = [e for e in endpoints if e[0]]
        healthy_active = [e for e in active_endpoints if e[1] == "healthy"]
        
        availability_pct = (len(healthy_active) / len(active_endpoints) * 100.0) if active_endpoints else 0.0
        
        # Latency
        metrics = conn.execute(text("SELECT ingestion_latency_ms, decode_latency_ms FROM pipeline_metrics WHERE inserted_at >= :start"), {"start": period_start}).fetchall()
        
    ingest_values = [float(m[0]) for m in metrics if m[0] is not None]
    decode_values = [float(m[1]) for m in metrics if m[1] is not None]
    
    def _p95(vals):
        if not vals: return 0.0
        s = sorted(vals)
        return float(s[int(len(s) * 0.95)])

    return {
        "period_days": days,
        "endpoint_health": {
            "total": len(endpoints),
            "active": len(active_endpoints),
            "healthy_active": len(healthy_active),
            "availability_pct": round(availability_pct, 2),
        },
        "latency_slo": {
            "ingest_p95_ms": round(_p95(ingest_values), 2),
            "decode_p95_ms": round(_p95(decode_values), 2),
            "sample_points": len(metrics),
        },
    }
