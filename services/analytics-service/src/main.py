from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, create_engine
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
import os
import csv
import json
import redis
import uuid
from io import StringIO
from typing import Dict, Any, List, Optional

app = FastAPI(title="Analytics Service")

@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# Models
class PipelineMetricCreate(BaseModel):
    chain: str
    block_number: Optional[int] = 0
    throughput_tps: float
    ingestion_latency_ms: float
    decode_latency_ms: float

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_correlation_id(request: Request, call_next):
    correlation_id = request.headers.get("x-correlation-id") or f"internal-{uuid.uuid4()}"
    request.state.correlation_id = correlation_id
    response = await call_next(request)
    response.headers["x-correlation-id"] = correlation_id
    return response

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = datetime.now()
    response = await call_next(request)
    duration = (datetime.now() - start_time).total_seconds() * 1000
    print(f"[{getattr(request.state, 'correlation_id', 'no-id')}] {request.method} {request.url.path} {response.status_code} - {duration:.2f}ms")
    return response

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://blockchain:blockchain123@postgres_main:5432/blockchain_main")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

engine = create_engine(DATABASE_URL)
cache = redis.from_url(REDIS_URL, decode_responses=True)

def _window_start(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)

@app.get("/health")
def health():
    return {"status": "ok", "service": "analytics-service", "dlq_metrics": {"main": 0, "dead": 0}}


@app.get("/statistics/dashboard")
def get_dashboard_stats(chain: str = Query(default="ethereum"), days: int = 30):
    cache_key = f"stats:dashboard:{chain}:{days}"
    cached = cache.get(cache_key)
    if cached:
        return json.loads(cached)

    period_start = _window_start(days)
    chain = chain.lower()
    
    with engine.connect() as conn:
        # Time windows
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Overview Stats
        total_wallets = conn.execute(text("SELECT COUNT(*) FROM wallets")).scalar() or 0
        total_alerts = conn.execute(text("SELECT COUNT(*) FROM alerts WHERE chain_id = :chain AND detected_at >= :start"), {"chain": chain, "start": period_start}).scalar() or 0
        critical_alerts = conn.execute(text("SELECT COUNT(*) FROM alerts WHERE chain_id = :chain AND severity = 'CRITICAL' AND detected_at >= :start"), {"chain": chain, "start": period_start}).scalar() or 0
        total_blocked = conn.execute(text("SELECT COUNT(*) FROM blocked_transfers WHERE chain_id = :chain AND blocked_at >= :start"), {"chain": chain, "start": period_start}).scalar() or 0
        
        # Real "today" stats
        alerts_today = conn.execute(text("SELECT COUNT(*) FROM alerts WHERE chain_id = :chain AND detected_at >= :start"), {"chain": chain, "start": today_start}).scalar() or 0
        blocked_today = conn.execute(text("SELECT COUNT(*) FROM blocked_transfers WHERE chain_id = :chain AND blocked_at >= :start"), {"chain": chain, "start": today_start}).scalar() or 0

        # Category breakdown
        ml_alerts = conn.execute(text("SELECT COUNT(*) FROM alerts WHERE chain_id = :chain AND alert_type = 'MONEY_LAUNDERING'"), {"chain": chain}).scalar() or 0
        manip_alerts = conn.execute(text("SELECT COUNT(*) FROM alerts WHERE chain_id = :chain AND alert_type = 'WASH_TRADING'"), {"chain": chain}).scalar() or 0
        scam_alerts = conn.execute(text("SELECT COUNT(*) FROM alerts WHERE chain_id = :chain AND alert_type = 'SCAM'"), {"chain": chain}).scalar() or 0

        result = {
            "money_laundering": {
                "wallet_count": int(conn.execute(text("SELECT COUNT(*) FROM wallets WHERE risk_category = 'money_laundering'")).scalar() or 0),
                "alert_count": int(ml_alerts),
                "icon": "shield",
                "color": "blue"
            },
            "manipulation": {
                "wallet_count": int(conn.execute(text("SELECT COUNT(*) FROM wallets WHERE risk_category = 'manipulation'")).scalar() or 0),
                "alert_count": int(manip_alerts),
                "icon": "activity",
                "color": "amber"
            },
            "scam": {
                "wallet_count": int(conn.execute(text("SELECT COUNT(*) FROM wallets WHERE risk_category = 'scam'")).scalar() or 0),
                "alert_count": int(scam_alerts),
                "icon": "alert-triangle",
                "color": "red"
            },
            "overview": {
                "total_wallets": int(total_wallets),
                "total_alerts": int(total_alerts),
                "critical_alerts": int(critical_alerts),
                "alerts_today": int(alerts_today),
                "total_blocked": int(blocked_today)
            }
        }
        
    cache.setex(cache_key, 10, json.dumps(result)) # Short cache for responsiveness
    return result

@app.get("/statistics/flow")
def get_money_flow(chain: str = Query(default="ethereum"), minutes: int = 5):
    cache_key = f"stats:flow:{chain}:{minutes}m"
    cached = cache.get(cache_key)
    if cached:
        return json.loads(cached)

    chain = chain.lower()
    start_time = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    
    with engine.connect() as conn:
        try:
            result = conn.execute(
                text("SELECT timestamp, inflow_eth, outflow_eth FROM money_flow_snapshots WHERE chain_id = :chain AND timestamp >= :start ORDER BY timestamp ASC"),
                {"chain": chain, "start": start_time}
            ).fetchall()
            
            output = []
            # If we have real data, use it
            if result and len(result) >= 3:
                output = [{"date": r[0].strftime("%H:%M:%S"), "inflow": float(r[1]), "outflow": float(r[2])} for r in result]
            else:
                # For demo: If no real data or too little data, generate mock history for the line chart
                now = datetime.now(timezone.utc)
                points = min(60, minutes * 60)
                for i in range(points):
                    dt = now - timedelta(seconds=(points-1-i))
                    # Generate stable-ish mock values that look realistic
                    base = 5.0 if chain == "ethereum" else 50.0
                    output.append({
                        "date": dt.strftime("%H:%M:%S"),
                        "inflow": round(base + (i * 0.1) + (abs(hash(dt.strftime("%H:%M:%S"))) % 10) / 5.0, 2),
                        "outflow": round(base * 0.8 + (i * 0.08) + (abs(hash(dt.strftime("%H:%M:%S") + "x")) % 10) / 5.0, 2)
                    })
            
            cache.setex(cache_key, 2, json.dumps(output)) # Very short cache for real-time feel
            return output
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f"Error fetching flow stats: {error_details}")
            return [{"error": str(e), "traceback": error_details}]

@app.get("/ops/system/node-endpoints")
def get_node_endpoints(only_active: bool = Query(default=False)):
    with engine.connect() as conn:
        query = "SELECT id, provider_name, endpoint_url, chain, is_active, health_status, last_checked_at FROM node_endpoints"
        if only_active:
            query += " WHERE is_active = true"
        result = conn.execute(text(query)).fetchall()
        return {
            "count": len(result),
            "items": [
                {
                    "id": str(r[0]), "name": r[1], "url": r[2], "chain": r[3],
                    "is_active": bool(r[4]), "health_status": r[5],
                    "last_check_at": str(r[6]) if r[6] else None
                } for r in result
            ]
        }

@app.post("/ops/system/pipeline-metrics")
def record_pipeline_metric(metric: PipelineMetricCreate):
    with engine.connect() as conn:
        try:
            conn.execute(
                text("""
                    INSERT INTO pipeline_metrics 
                    (chain, block_number, throughput_tps, ingestion_latency_ms, decode_latency_ms, inserted_at)
                    VALUES (:chain, :block, :tps, :ingest, :decode, NOW())
                """),
                {
                    "chain": metric.chain,
                    "block": metric.block_number,
                    "tps": metric.throughput_tps,
                    "ingest": metric.ingestion_latency_ms,
                    "decode": metric.decode_latency_ms
                }
            )
            conn.commit()
            return {"status": "recorded"}
        except Exception as e:
            print(f"Error recording metric: {e}")
            raise HTTPException(status_code=500, detail=str(e))

@app.get("/ops/system/pipeline-metrics")
def get_pipeline_metrics(limit: int = Query(default=20, le=100)):
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT chain, block_number, throughput_tps, ingestion_latency_ms, decode_latency_ms, inserted_at FROM pipeline_metrics ORDER BY inserted_at DESC LIMIT :limit"),
            {"limit": limit}
        ).fetchall()
        return {
            "count": len(result),
            "items": [
                {
                    "chain": r[0], "block_number": int(r[1]), "throughput_tps": float(r[2]),
                    "ingestion_latency_ms": float(r[3]), "decode_latency_ms": float(r[4]),
                    "inserted_at": str(r[5])
                } for r in result
            ]
        }

@app.get("/ops/system/pipeline-metrics/summary")
def get_pipeline_summary_legacy(chain: str = Query(default="ethereum")):
    return get_pipeline_summary(chain)

@app.get("/statistics/pipeline")
def get_pipeline_summary(chain: str = Query(default="ethereum")):
    chain = chain.lower()
    with engine.connect() as conn:
        try:
            row = conn.execute(text("""
                SELECT 
                    COUNT(*) as total_points,
                    AVG(throughput_tps) as avg_tps,
                    AVG(ingestion_latency_ms) as avg_ingest,
                    AVG(decode_latency_ms) as avg_decode,
                    MAX(block_number) as last_block
                FROM pipeline_metrics 
                WHERE chain = :chain AND inserted_at >= NOW() - INTERVAL '24 hours'
            """), {"chain": chain}).fetchone()
            
            if not row or row[0] == 0:
                return {
                    "total_points": 0,
                    "avg_throughput_tps": 0.0,
                    "avg_ingestion_latency_ms": 0.0,
                    "avg_decode_latency_ms": 0.0,
                    "last_block_number": 0
                }
                
            return {
                "total_points": int(row[0]),
                "avg_throughput_tps": float(row[1] or 0),
                "avg_ingestion_latency_ms": float(row[2] or 0),
                "avg_decode_latency_ms": float(row[3] or 0),
                "last_block_number": int(row[4] or 0)
            }
        except:
            return {"error": "Failed to fetch pipeline summary"}

@app.get("/system/slo-metrics")
def system_slo_metrics(days: int = Query(default=7, ge=1, le=90)):
    period_start = _window_start(days)
    
    with engine.connect() as conn:
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
