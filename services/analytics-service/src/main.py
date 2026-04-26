from fastapi import FastAPI, Query, HTTPException
from sqlalchemy import text, create_engine
from datetime import datetime, timedelta, timezone
import os
import csv
from io import StringIO
from typing import Dict, Any, List

app = FastAPI(title="Analytics Service")

DATABASE_URL_MAIN = os.getenv("DATABASE_URL", "postgresql://blockchain:blockchain123@postgres_main:5432/blockchain_main")
DATABASE_URL_ALERTS = os.getenv("DATABASE_URL_ALERTS", "postgresql://blockchain:blockchain123@postgres_alerts:5432/blockchain_alerts")
DATABASE_URL_TRANSFERS = os.getenv("DATABASE_URL_TRANSFERS", "postgresql://blockchain:blockchain123@postgres_transfers:5432/blockchain_transfers")

engine_main = create_engine(DATABASE_URL_MAIN)
engine_alerts = create_engine(DATABASE_URL_ALERTS)
engine_transfers = create_engine(DATABASE_URL_TRANSFERS)

def _window_start(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)

def _to_eth(value_wei: Any) -> float:
    if value_wei is None:
        return 0.0
    return float(value_wei) / 10**18

@app.get("/health")
def health():
    return {"status": "ok", "service": "analytics-service"}

@app.get("/statistics/dashboard")
@app.get("/compliance/reporting/summary")
def compliance_reporting_summary(days: int = Query(default=30, ge=1, le=365)):
    period_start = _window_start(days)
    
    # KPIs from multiple databases
    with engine_alerts.connect() as conn_alerts, \
         engine_main.connect() as conn_main, \
         engine_transfers.connect() as conn_transfers:
        
        # Alerts (Alerts DB)
        alerts_total = conn_alerts.execute(text("SELECT COUNT(*) FROM alerts WHERE detected_at >= :start"), {"start": period_start}).scalar()
        critical_alerts = conn_alerts.execute(text("SELECT COUNT(*) FROM alerts WHERE detected_at >= :start AND severity = 'CRITICAL'"), {"start": period_start}).scalar()
        
        # Blocked (Main DB)
        blocked_total = conn_main.execute(text("SELECT COUNT(*) FROM blocked_transfers WHERE blocked_at >= :start"), {"start": period_start}).scalar()
        
        # Dashboard Stats Construction
        return {
            "money_laundering": {
                "wallet_count": int(conn_main.execute(text("SELECT COUNT(*) FROM wallets WHERE risk_category = 'money_laundering'")).scalar() or 0),
                "alert_count": int(conn_alerts.execute(text("SELECT COUNT(*) FROM alerts WHERE alert_type IN ('LAYERING', 'STRUCTURING', 'INTEGRATION', 'MIXER_DEPOSIT')")).scalar() or 0),
                "icon": "shield",
                "color": "blue"
            },
            "manipulation": {
                "wallet_count": int(conn_main.execute(text("SELECT COUNT(*) FROM wallets WHERE risk_category = 'manipulation'")).scalar() or 0),
                "alert_count": int(conn_alerts.execute(text("SELECT COUNT(*) FROM alerts WHERE alert_type IN ('WASH_TRADING', 'PUMP_AND_DUMP')")).scalar() or 0),
                "icon": "activity",
                "color": "amber"
            },
            "scam": {
                "wallet_count": int(conn_main.execute(text("SELECT COUNT(*) FROM wallets WHERE risk_category = 'scam'")).scalar() or 0),
                "alert_count": int(conn_alerts.execute(text("SELECT COUNT(*) FROM alerts WHERE alert_type IN ('PHISHING', 'RUG_PULL', 'HACKER_TRANSFER')")).scalar() or 0),
                "icon": "alert-triangle",
                "color": "red"
            },
            "overview": {
                "total_wallets": int(conn_main.execute(text("SELECT COUNT(*) FROM wallets")).scalar() or 0),
                "total_alerts": int(alerts_total or 0),
                "critical_alerts": int(critical_alerts or 0),
                "alerts_today": int(conn_alerts.execute(text("SELECT COUNT(*) FROM alerts WHERE detected_at >= NOW() - INTERVAL '1 day'")).scalar() or 0),
                "total_blocked": int(blocked_total or 0)
            }
        }

@app.get("/system/slo-metrics")
def system_slo_metrics(days: int = Query(default=7, ge=1, le=90)):
    period_start = _window_start(days)
    
    with engine_main.connect() as conn:
        # Endpoint health (Main DB)
        try:
            endpoints = conn.execute(text("SELECT is_active, health_status FROM node_endpoints")).fetchall()
        except:
            endpoints = []
        
        active_endpoints = [e for e in endpoints if e[0]]
        healthy_active = [e for e in active_endpoints if e[1] == "healthy"]
        
        availability_pct = (len(healthy_active) / len(active_endpoints) * 100.0) if active_endpoints else 0.0
        
        # Latency (Main DB)
        try:
            metrics = conn.execute(text("SELECT ingestion_latency_ms, decode_latency_ms FROM pipeline_metrics WHERE inserted_at >= :start"), {"start": period_start}).fetchall()
        except:
            metrics = []
        
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
