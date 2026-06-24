"""FastAPI application for blockchain wallet risk assessment."""

import logging
import os
import re
import secrets
from datetime import datetime, timezone
from io import StringIO
import csv
from typing import Dict, List, Any, Optional
import uuid
import redis
import json

from fastapi import FastAPI, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

class CorrelationIdFilter(logging.Filter):
    def filter(self, record):
        record.correlation_id = getattr(record, 'correlation_id', 'no-id')
        return True

class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "correlation_id": getattr(record, 'correlation_id', 'no-id'),
            "message": record.getMessage(),
        }
        if record.exc_info and record.exc_info[0]:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)

use_json = os.getenv("LOG_FORMAT", "").lower() == "json"
if use_json:
    _handler = logging.StreamHandler()
    _handler.setFormatter(JsonFormatter())
    logging.basicConfig(level=logging.INFO, handlers=[_handler])
else:
    logging.basicConfig(
        level=logging.INFO,
        format='[%(correlation_id)s] %(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

logger = logging.getLogger(__name__)
for handler in logging.root.handlers:
    handler.addFilter(CorrelationIdFilter())

# Redis client for Caching
_redis_default = "redis://redis:6379/0" if not os.getenv("SPACE_ID") else None
REDIS_URL = os.getenv("REDIS_URL", _redis_default)
if REDIS_URL:
    try:
        cache = redis.from_url(REDIS_URL, decode_responses=True)
        logger.info(f"Redis connected at {REDIS_URL}")
    except Exception as e:
        logger.warning(f"Failed to connect to Redis: {e}. Caching will be disabled.")
        cache = None
else:
    logger.info("Redis not configured. Caching disabled.")
    cache = None
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, case

from app import schemas  # noqa: F401  # ensure schemas are imported for OpenAPI generation
from app.core.database import get_db, ensure_schema
from app.models.models import Wallet, Transaction, TokenTransfer, RiskAssessment, Blacklist, Alert, User, BlockedTransfer, UserWarning, AuditLog, FeedbackLabel, TransactionCase, NodeEndpoint, PipelineMetric, FeatureStoreConfig, ModelRegistry, PolicyRule, DiagnosticEvent, MoneyFlowSnapshot, Organization, ExchangeRate
from blockchain_client import fetch_wallet_history
from app.core.config import ALCHEMY_API_KEY, ALCHEMY_ETH_RPC_URL, ALCHEMY_BSC_RPC_URL, GEMINI_API_KEY, GEMINI_MODEL
from app.services.ai_engine import MultiAgentDetectionEngine, MLRiskPredictor
from app.services.persistence import persist_transactions
from app.services.hf_security_analyst import HFSecurityAnalyst
from app.services.assistant_knowledge_base import retrieve_relevant_snippets
from app.services.ai_agent_improvements import (
    _build_enhanced_dashboard_context,
    _detect_question_intent,
    _build_dynamic_account_support_answer,
    _build_dynamic_dashboard_answer,
    _build_operational_guidance_answer,
)
from app.admin_diagnostics import (
    diagnostic_logger,
    log_diagnostic,
    get_system_status,
    get_seed_data_counts,
    DiagnosticLogType,
)
from app.utils.api_response import api_success, api_error


# --- Pydantic Request Schemas ---

class ProtectedTransferRequest(BaseModel):
    from_wallet_id: str = ""
    to_wallet_id: str = ""
    to_address: str = ""
    amount_eth: float = 0
    confirm_risk: bool = False
    chain: str = "ethereum"
    asset: str = "ETH"

class SendEthRequest(BaseModel):
    sender: str = ""
    receiver: str = ""
    amount: float = 0

class UpdateWalletStatusRequest(BaseModel):
    status: str = ""
    reason: str = ""
    admin_id: str = "system"

class SubmitFeedbackRequest(BaseModel):
    wallet_address: str = ""
    admin_label: str = ""
    admin_category: Optional[str] = None
    admin_notes: Optional[str] = None
    admin_username: str = "anonymous"

class SendWithWarningRequest(BaseModel):
    sender: str = ""
    receiver: str = ""
    amount: float = 0
    force_proceed: bool = False

class BatchTransferItem(BaseModel):
    from_address: str = ""
    to_address: str = ""
    amount_eth: float = 0

class BatchTransferRequest(BaseModel):
    transfers: List[BatchTransferItem] = []

class ExchangeEstimateRequest(BaseModel):
    from_currency: str = "ETH"
    to_currency: str = "USD"
    amount: float = 0


def _get_or_create_wallet(database_session: Session, address: str) -> Wallet:
    wallet = database_session.query(Wallet).filter(Wallet.address == address).first()
    if not wallet:
        wallet = Wallet(address=address)
        database_session.add(wallet)
        database_session.commit()
        database_session.refresh(wallet)

    return wallet


def _wei_from_eth(amount_eth: float) -> int:
    return int(round(amount_eth * 10**18))


def _eth_from_wei(amount_wei: int) -> float:
    return float(amount_wei) / 10**18


def _execute_single_transfer(database_session: Session, from_addr: str, to_addr: str, amount_eth: float) -> Dict[str, Any]:
    amount_wei = _wei_from_eth(amount_eth)
    tx_hash = "0x" + uuid.uuid4().hex
    sender_wallet = _get_or_create_wallet(database_session, from_addr)
    receiver_wallet = _get_or_create_wallet(database_session, to_addr)
    tx = Transaction(
        tx_hash=tx_hash, from_address=from_addr, to_address=to_addr,
        value=amount_wei, block_number=0, timestamp=datetime.now(timezone.utc),
        status=1
    )
    database_session.add(tx)
    sender_wallet.total_value_sent = int(sender_wallet.total_value_sent or 0) + amount_wei
    sender_wallet.total_transactions = int(sender_wallet.total_transactions or 0) + 1
    sender_wallet.last_activity_at = datetime.now(timezone.utc)
    receiver_wallet.total_value_received = int(receiver_wallet.total_value_received or 0) + amount_wei
    receiver_wallet.total_transactions = int(receiver_wallet.total_transactions or 0) + 1
    receiver_wallet.last_activity_at = datetime.now(timezone.utc)
    database_session.commit()
    return {"tx_hash": tx_hash, "from": from_addr, "to": to_addr, "amount_eth": amount_eth}


def _normalize_chain_name(chain: str) -> str:
    """Normalize chain alias to canonical name (ethereum or bsc)."""
    chain = chain.lower().strip()

    if chain in ["ethereum", "eth", "1"]:
        return "ethereum"
    elif chain in ["bsc", "binance", "bnb", "56"]:
        return "bsc"
    else:
        raise HTTPException(status_code=400, detail=f"Invalid chain: {chain}. Supported: ethereum, eth, 1, bsc, bnb, binance, 56")


def _normalize_assistant_answer(answer: str) -> str:
    """Clean model output so dashboard chat stays concise and readable."""
    if not answer:
        return "Hiện chưa có đủ dữ liệu để trả lời chính xác."

    text = answer.strip()
    # Remove accidental metadata echoes generated by the model.
    text = re.sub(r"(?im)^\s*(sources?|docs?)\s*:.*$", "", text)
    # Normalize odd markdown symbols that often appear around headings.
    text = text.replace("**", "").replace("* ", "- ")
    text = re.sub(r"\n{3,}", "\n\n", text)

    lines = [line.rstrip() for line in text.splitlines()]
    cleaned_lines = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if cleaned_lines and cleaned_lines[-1] != "":
                cleaned_lines.append("")
            continue
        # Keep numbered outline and simple bullets only.
        if re.match(r"^\d+\)", stripped):
            cleaned_lines.append(stripped)
        elif stripped.startswith(("-", "•")):
            cleaned_lines.append(f"- {stripped.lstrip('-• ').strip()}")
        else:
            cleaned_lines.append(stripped)

    normalized = "\n".join(cleaned_lines).strip()
    return normalized or "Hiện chưa có đủ dữ liệu để trả lời chính xác."


from app.utils.auth_utils import get_org_id


def _dedupe_preserve_order(values: List[str]) -> List[str]:
    seen = set()
    deduped: List[str] = []
    for value in values:
        key = value.strip()
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(key)
    return deduped


def _is_low_quality_answer(answer: str) -> bool:
    text = (answer or "").strip()
    if not text:
        return True

    # CRITICAL: Check for error/API failure responses (these are ALWAYS low quality)
    error_patterns = [
        "tạm thời không khả dụng",
        "không có đủ dữ liệu",
        "vui lòng kiểm tra",
        "gặp lỗi",
        "xin lỗi",
        '"error"',  # JSON error response
        '"code":',  # JSON error with code
    ]
    for pattern in error_patterns:
        if pattern.lower() in text.lower():
            # Error messages are ALWAYS low quality, regardless of length
            return True

    # CRITICAL: Check for incomplete/truncated responses
    incomplete_indicators = [
        "Dựa trên dữ liệu",  # Incomplete prefix that's often cut off
        "Chào người",  # Greeting that leads to truncation
        "Với vai trò là",  # Role assignment that's often incomplete
        "được rồi",  # Bare acknowledgement
    ]

    for indicator in incomplete_indicators:
        if indicator.lower() in text.lower():
            # If we find incomplete prefix, check if content is too short
            # Most complete answers should have 150+ chars and 3+ periods
            if len(text) < 150 or text.count(".") < 3:
                return True

    # Check for responses ending with just bullet or incomplete line
    if text.rstrip().endswith("-") or text.rstrip().endswith("•"):
        return True

    # Check for responses that look like they got cut mid-word (ends with comma + short tail)
    if text.rstrip().endswith(","):
        # Incomplete sentence ending in comma
        last_line = text.split("\n")[-1]
        if len(last_line.strip()) < 20:
            return True

    return False


def _validate_ethereum_address(address: str) -> str:
    normalized = address.lower().strip()
    if not re.match(r"^0x[a-f0-9]{40}$", normalized):
        raise HTTPException(status_code=400, detail="Invalid wallet address: must be 0x + 40 hex characters")
    return normalized


def _validate_transaction_hash(tx_hash: str) -> str:
    normalized = tx_hash.lower().strip()
    if not re.match(r"^0x[a-f0-9]{64}$", normalized):
        raise HTTPException(status_code=400, detail="Invalid transaction hash: must be 0x + 64 hex characters")
    return normalized


def _is_account_support_question(question: str) -> bool:
    text = (question or "").lower()
    support_terms = [
        "tạo tài khoản",
        "tao tai khoan",
        "đăng ký",
        "dang ky",
        "register",
        "signup",
        "sign up",
        "account",
        "login",
        "đăng nhập",
        "dang nhap",
    ]
    return any(term in text for term in support_terms)


def _is_system_component_question(question: str) -> bool:
    text = (question or "").lower()
    system_terms = [
        "thành phần", "thanh phan",
        "hệ thống", "he thong",
        "cấu trúc", "cau truc",
        "architecture", "component",
        "hoạt động", "hoat dong",
        "frontend", "backend",
        "ai engine", "công nghệ", "cong nghe"
    ]
    return any(term in text for term in system_terms)


def _build_system_component_answer(question: str, database_session: Session = None) -> str:
    """Build system component answer using knowledge base or database data."""
    from app.services.assistant_knowledge_base import retrieve_relevant_snippets
    
    # Try to use knowledge base first
    snippets = retrieve_relevant_snippets(question, role="admin", scope="dashboard", limit=3)
    if snippets:
        kb_content = "\n\n".join([s.content for s in snippets])
        return f"Thông tin hệ thống (từ tài liệu dự án):\n\n{kb_content[:1500]}"
    
    # Fallback with dynamic data if session available
    system_info = {
        "model_info": "Multi-Agent Random Forest",
        "wallet_count": 0,
        "alert_count": 0,
    }
    
    if database_session:
        try:
            from app.models.models import Wallet, Alert
            system_info["wallet_count"] = database_session.query(func.count(Wallet.id)).scalar() or 0
            system_info["alert_count"] = database_session.query(func.count(Alert.id)).scalar() or 0
        except Exception as e:
            logger.warning(f"Could not fetch system stats: {e}")
    
    return (
        "1) Giải thích các thành phần chính\n"
        "- Frontend (Next.js): Giao diện người dùng hiện đại, sử dụng Tailwind CSS và Recharts.\n"
        "- Backend (FastAPI): Hệ thống xử lý trung tâm, quản lý dữ liệu blockchain, chạy AI Detection Engine.\n"
        f"- AI Detection Engine: {system_info['model_info']} - Phát hiện Rửa tiền, Thao túng, Lừa đảo.\n"
        f"- Database: {system_info['wallet_count']} ví, {system_info['alert_count']} cảnh báo theo dõi.\n\n"
        "2) Cơ chế vận hành\n"
        "- Hệ thống hoạt động theo RBAC với 4 vai trò: System Admin, AI Data Engineer, Security Analyst, Compliance Manager.\n"
        "- Dữ liệu được tổng hợp theo thời gian thực từ blockchain và AI chấm điểm rủi ro.\n\n"
        "3) Hành động đề xuất\n"
        "- Vào 'Insights' để xem chi tiết từng ví.\n"
        "- Vào 'Reporting' để xem báo cáo KPI."
    )


def _initialize_database() -> None:
    try:
        ensure_schema()
    except Exception as error:
        logger.warning(f"Database schema initialization skipped or failed: {error}")

_initialize_database()

# Sentry SDK initialization
_sentry_dsn = os.getenv("SENTRY_DSN", "")
if _sentry_dsn:
    try:
        import sentry_sdk
        sentry_sdk.init(dsn=_sentry_dsn, traces_sample_rate=0.1)
        logger.info("Sentry SDK initialized")
    except Exception as e:
        logger.warning(f"Sentry SDK init failed: {e}")

app = FastAPI(
    title="Blockchain Risk Assessment API",
    version="3.0.0",
    description="AI-powered financial risk analysis for Ethereum wallets with Alchemy integration"
)

# Startup validation - check critical configuration
_api_key_warnings = []
if not ALCHEMY_API_KEY or ALCHEMY_API_KEY in ("your_alchemy_api_key_here", ""):
    _api_key_warnings.append("ALCHEMY_API_KEY not configured — blockchain data fetching disabled")
if not GEMINI_API_KEY or GEMINI_API_KEY in ("your_gemini_api_key_here", ""):
    _api_key_warnings.append(f"GEMINI_API_KEY not configured — AI analyst ({GEMINI_MODEL}) disabled")
for _warn in _api_key_warnings:
    logger.warning(f"CONFIG: {_warn}")
if _api_key_warnings:
    logger.warning(f"CONFIG: {len(_api_key_warnings)} configuration issue(s) detected — some features unavailable until API keys are set in .env")

# Rate limiting setup
_disable_limiter = os.environ.get("DISABLE_RATE_LIMIT", "").lower() in ("1", "true", "yes")
if _disable_limiter:
    limiter = Limiter(key_func=get_remote_address, default_limits=["1000000/minute"])
else:
    limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Prometheus metrics
try:
    from prometheus_fastapi_instrumentator import Instrumentator
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")
    logger.info("Prometheus metrics exposed at /metrics")
except Exception as e:
    logger.warning(f"Prometheus instrumentation failed: {e}")

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
    logger.info(f"[{getattr(request.state, 'correlation_id', 'no-id')}] {request.method} {request.url.path} {response.status_code} - {duration:.2f}ms")
    return response

# Add CORS middleware; use explicit origins in production.
raw_cors_origins = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
cors_allowed_origins = [item.strip() for item in raw_cors_origins.split(",") if item.strip()]
if not cors_allowed_origins:
    cors_allowed_origins = ["http://localhost:3000"]

cors_allow_credentials = "*" not in cors_allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allowed_origins,
    allow_credentials=cors_allow_credentials,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token", "X-Requested-With"],
)

# ---------------------------------------------------------------------------
# Security Headers
# ---------------------------------------------------------------------------
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# ---------------------------------------------------------------------------
# CSRF Protection – only enforced when cookie auth is used without Bearer
# ---------------------------------------------------------------------------
@app.middleware("http")
async def csrf_protection(request: Request, call_next):
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        exempt = ("/auth/login", "/auth/register", "/auth/csrf-token")
        if not any(request.url.path.startswith(p) for p in exempt):
            auth_header = request.headers.get("Authorization", "")
            csrf_cookie = request.cookies.get("auth_token")
            if csrf_cookie and not auth_header.startswith("Bearer "):
                csrf_header = request.headers.get("X-CSRF-Token", "")
                if not csrf_header or not verify_csrf_token(csrf_header):
                    log_diagnostic(
                        DiagnosticLogType.API_ERROR,
                        f"CSRF rejection on {request.method} {request.url.path}",
                        status_code=403,
                        endpoint=str(request.url.path),
                    )
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content={"detail": "CSRF token missing or invalid"},
                    )
    response = await call_next(request)
    return response

# ---------------------------------------------------------------------------
# Global exception handlers – standardise all error responses
# ---------------------------------------------------------------------------
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    log_diagnostic(
        DiagnosticLogType.API_ERROR,
        f"HTTP {exc.status_code}: {exc.detail}",
        status_code=exc.status_code,
        endpoint=str(request.url.path),
    )
    body = api_error(
        message=str(exc.detail),
        code=f"HTTP_{exc.status_code}",
        details={"path": request.url.path, "method": request.method},
    )
    return JSONResponse(status_code=exc.status_code, content=body, headers=getattr(exc, "headers", None))


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(f"Unhandled exception on {request.method} {request.url.path}: {exc}")
    log_diagnostic(
        DiagnosticLogType.ERROR,
        f"Unhandled exception: {type(exc).__name__}: {exc}",
        status_code=500,
        endpoint=str(request.url.path),
    )
    body = api_error(
        message="Internal server error",
        code="INTERNAL_ERROR",
        details={"path": request.url.path, "method": request.method, "type": type(exc).__name__},
    )
    return JSONResponse(status_code=500, content=body)

# Mount authentication router
from app.auth import router as auth_router, optional_auth, require_admin, admin_or_analyst, require_csrf, verify_csrf_token
app.include_router(auth_router)

# Mount case-management router
from app.case_management import router as case_router
app.include_router(case_router)

# Mount Phase 2 operations router
from app.phase2_ops import router as phase2_ops_router
app.include_router(phase2_ops_router)

# Mount Phase 3 governance router
from app.phase3_governance import router as phase3_governance_router
app.include_router(phase3_governance_router)

# Mount Phase 4 reporting router
from app.phase4_reporting import router as phase4_reporting_router
app.include_router(phase4_reporting_router)
# Include AI router (has been extracted to separate module)
from app.ai_router import router as ai_router
app.include_router(ai_router)


@app.get("/", tags=["Health"])
def health_check() -> Dict[str, str]:
    """API health check endpoint."""
    return {"status": "operational", "service": "Blockchain Risk Assessment API v3.0"}

@app.get("/version", tags=["Info"])
def get_version() -> Dict[str, str]:
    """Return AI service version."""
    return {"service": "AI Service", "version": os.getenv("AI_MODEL_VERSION", "v1.0")}



# ============================================================================
# ADMIN DIAGNOSTICS ENDPOINTS
# ============================================================================

@app.get("/admin/diagnostics/status", tags=["Admin Diagnostics"])
def get_diagnostics_status(admin: User = Depends(require_admin), database_session: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get comprehensive system status for admin dashboard."""
    try:
        status = get_system_status(database_session)
        log_diagnostic(
            DiagnosticLogType.INFO,
            "Admin diagnostics status checked",
            status_code=200,
            endpoint="/admin/diagnostics/status"
        )
        return api_success(data=status, message="Diagnostics status fetched", legacy=status)
    except Exception as e:
        logger.exception(f"Failed to get diagnostics status: {e}")
        log_diagnostic(
            DiagnosticLogType.ERROR,
            f"Diagnostics status failed: {str(e)}",
            status_code=500,
            endpoint="/admin/diagnostics/status"
        )
        fallback = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": str(e),
            "database": {"health": {"status": "error", "error": str(e)}},
            "seed_data": {},
            "endpoints": {},
            "recent_errors": [],
        }
        return api_error(message="Failed to get diagnostics status", code="DIAGNOSTICS_STATUS_FAILED", details={"error": str(e)}, legacy=fallback)


class DiagnosticLogCreatePayload(BaseModel):
    log_type: str
    message: str
    details: Dict[str, Any] | None = None
    status_code: int | None = None
    endpoint: str | None = None


class DiagnosticLogArchivePayload(BaseModel):
    archived: bool = True


class DiagnosticLogBulkArchivePayload(BaseModel):
    archived: bool = True
    log_type: str | None = None
    search: str | None = None
    endpoint: str | None = None
    min_status_code: int | None = None
    include_archived: bool = False
    max_rows: int = 500


def _parse_diagnostic_uuid(raw_id: str) -> uuid.UUID:
    try:
        return uuid.UUID(raw_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid diagnostic log id") from exc


@app.get("/admin/diagnostics/logs", tags=["Admin Diagnostics"])
def get_diagnostics_logs(
    admin: User = Depends(require_admin),
    limit: int = 50,
    log_type: str = None,
    endpoint: str | None = None,
    min_status_code: int | None = None,
    include_archived: bool = False,
    database_session: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Get recent diagnostic logs."""
    log_diagnostic(
        DiagnosticLogType.API_CALL,
        "Diagnostics logs requested",
        details={
            "limit": int(limit),
            "log_type": log_type,
            "endpoint": endpoint,
            "min_status_code": min_status_code,
            "include_archived": include_archived,
        },
        status_code=200,
        endpoint="/admin/diagnostics/logs"
    )

    limit = max(1, min(int(limit or 50), 1000))
    query = database_session.query(DiagnosticEvent)
    if not include_archived:
        query = query.filter(DiagnosticEvent.is_archived.is_(False))

    if log_type:
        query = query.filter(DiagnosticEvent.log_type == log_type)
    if endpoint:
        query = query.filter(DiagnosticEvent.endpoint.ilike(f"%{endpoint.strip()}%"))
    if min_status_code is not None:
        query = query.filter(DiagnosticEvent.status_code.isnot(None), DiagnosticEvent.status_code >= int(min_status_code))

    rows = query.order_by(DiagnosticEvent.timestamp.desc()).limit(limit).all()
    logs = [
        {
            "id": str(row.id),
            "timestamp": row.timestamp.isoformat() if row.timestamp else None,
            "log_type": row.log_type,
            "type": row.log_type,
            "message": row.message,
            "details": row.details or {},
            "status_code": row.status_code,
            "endpoint": row.endpoint,
            "source": row.source,
            "is_archived": bool(row.is_archived),
            "archived_at": row.archived_at.isoformat() if row.archived_at else None,
        }
        for row in rows
    ]
    response = {
        "count": len(logs),
        "logs": logs,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return api_success(data=response, message="Diagnostics logs fetched", alert_metadata={"count": len(logs)}, legacy=response)


@app.post("/admin/diagnostics/logs", tags=["Admin Diagnostics"])
def create_diagnostics_log(payload: DiagnosticLogCreatePayload, admin: User = Depends(require_admin), database_session: Session = Depends(get_db)) -> Dict[str, Any]:
    event = DiagnosticEvent(
        log_type=payload.log_type.strip().lower(),
        message=payload.message,
        details=payload.details or {},
        status_code=payload.status_code,
        endpoint=payload.endpoint,
        source="admin",
    )
    database_session.add(event)
    database_session.commit()
    database_session.refresh(event)

    response = {
        "id": str(event.id),
        "log_type": event.log_type,
        "message": event.message,
        "timestamp": event.timestamp.isoformat() if event.timestamp else None,
    }
    return api_success(data=response, message="Diagnostic log created", legacy=response)


@app.patch("/admin/diagnostics/logs/{log_id}/archive", tags=["Admin Diagnostics"])
def archive_diagnostics_log(log_id: str, payload: DiagnosticLogArchivePayload, admin: User = Depends(require_admin), database_session: Session = Depends(get_db)) -> Dict[str, Any]:
    event_id = _parse_diagnostic_uuid(log_id)
    event = database_session.query(DiagnosticEvent).filter(DiagnosticEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Diagnostic log not found")

    event.is_archived = bool(payload.archived)
    event.archived_at = datetime.now(timezone.utc) if payload.archived else None
    database_session.commit()

    response = {
        "id": str(event.id),
        "is_archived": bool(event.is_archived),
        "archived_at": event.archived_at.isoformat() if event.archived_at else None,
    }
    return api_success(data=response, message="Diagnostic log archive status updated", legacy=response)


@app.post("/admin/diagnostics/logs/archive", tags=["Admin Diagnostics"])
def archive_diagnostics_logs(payload: DiagnosticLogBulkArchivePayload, admin: User = Depends(require_admin), database_session: Session = Depends(get_db)) -> Dict[str, Any]:
    max_rows = max(1, min(int(payload.max_rows or 500), 5000))
    query = database_session.query(DiagnosticEvent)

    if not payload.include_archived:
        query = query.filter(DiagnosticEvent.is_archived.is_(False))
    if payload.log_type:
        query = query.filter(DiagnosticEvent.log_type == payload.log_type.strip().lower())
    if payload.endpoint:
        query = query.filter(DiagnosticEvent.endpoint.ilike(f"%{payload.endpoint.strip()}%"))
    if payload.search:
        search_term = f"%{payload.search.strip()}%"
        query = query.filter((DiagnosticEvent.message.ilike(search_term)) | (DiagnosticEvent.endpoint.ilike(search_term)))
    if payload.min_status_code is not None:
        query = query.filter(DiagnosticEvent.status_code.isnot(None), DiagnosticEvent.status_code >= int(payload.min_status_code))

    rows = query.order_by(DiagnosticEvent.timestamp.desc()).limit(max_rows).all()
    archive_state = bool(payload.archived)
    archive_time = datetime.now(timezone.utc) if archive_state else None

    archived_ids: List[str] = []
    for item in rows:
        item.is_archived = archive_state
        item.archived_at = archive_time
        archived_ids.append(str(item.id))

    database_session.commit()

    response = {
        "archived": archive_state,
        "matched": len(rows),
        "archived_ids": archived_ids,
    }
    return api_success(data=response, message="Diagnostics logs archive operation completed", legacy=response)


@app.delete("/admin/diagnostics/logs/{log_id}", tags=["Admin Diagnostics"])
def delete_diagnostics_log(log_id: str, admin: User = Depends(require_admin), database_session: Session = Depends(get_db)) -> Dict[str, Any]:
    event_id = _parse_diagnostic_uuid(log_id)
    event = database_session.query(DiagnosticEvent).filter(DiagnosticEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Diagnostic log not found")

    database_session.delete(event)
    database_session.commit()

    response = {"id": log_id, "deleted": True}
    return api_success(data=response, message="Diagnostic log deleted", legacy=response)


@app.get("/admin/diagnostics/logs/export", tags=["Admin Diagnostics"])
def export_diagnostics_logs(
    date: str | None = Query(default=None, description="YYYY-MM-DD in UTC"),
    include_archived: bool = False,
    database_session: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> Dict[str, Any]:
    query = database_session.query(DiagnosticEvent)
    if not include_archived:
        query = query.filter(DiagnosticEvent.is_archived.is_(False))

    selected_date = None
    if date:
        try:
            selected_date = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD") from exc

    rows = query.order_by(DiagnosticEvent.timestamp.desc()).limit(5000).all()
    if selected_date is not None:
        rows = [item for item in rows if item.timestamp and item.timestamp.date() == selected_date]

    csv_buffer = StringIO()
    writer = csv.DictWriter(csv_buffer, fieldnames=["id", "timestamp", "log_type", "message", "status_code", "endpoint", "source", "is_archived"])
    writer.writeheader()
    export_rows = []
    for row in rows:
        row_data = {
            "id": str(row.id),
            "timestamp": row.timestamp.isoformat() if row.timestamp else None,
            "log_type": row.log_type,
            "message": row.message,
            "status_code": row.status_code,
            "endpoint": row.endpoint,
            "source": row.source,
            "is_archived": bool(row.is_archived),
        }
        writer.writerow(row_data)
        export_rows.append(row_data)

    filename_date = selected_date.isoformat() if selected_date else datetime.now(timezone.utc).strftime("%Y-%m-%d")
    response = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "date": filename_date,
        "count": len(export_rows),
        "filename": f"diagnostics_logs_{filename_date}.csv",
        "rows": export_rows,
        "csv": csv_buffer.getvalue(),
    }
    return api_success(data=response, message="Diagnostics export generated", alert_metadata={"count": len(export_rows)}, legacy=response)


@app.get("/admin/diagnostics/endpoint-stats", tags=["Admin Diagnostics"])
def get_endpoint_statistics(admin: User = Depends(require_admin)) -> Dict[str, Any]:
    """Get API endpoint statistics and health."""
    log_diagnostic(
        DiagnosticLogType.API_CALL,
        "Endpoint statistics requested",
        status_code=200,
        endpoint="/admin/diagnostics/endpoint-stats"
    )
    stats = diagnostic_logger.get_endpoint_stats()
    response = {
        "endpoints": stats,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return api_success(data=response, message="Endpoint statistics fetched", legacy=response)


@app.get("/admin/diagnostics/seed-data", tags=["Admin Diagnostics"])
def get_seed_data_status(admin: User = Depends(require_admin), database_session: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get seed data counts for all tables."""
    try:
        counts = get_seed_data_counts(database_session)
        log_diagnostic(
            DiagnosticLogType.SEED_DATA,
            "Seed data status checked",
            details=counts,
            status_code=200,
            endpoint="/admin/diagnostics/seed-data"
        )
        response = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "counts": counts,
        }
        return api_success(data=response, message="Seed data status fetched", legacy=response)
    except Exception as e:
        logger.exception(f"Failed to get seed data counts: {e}")
        log_diagnostic(
            DiagnosticLogType.ERROR,
            f"Seed data check failed: {str(e)}",
            status_code=500,
            endpoint="/admin/diagnostics/seed-data"
        )
        fallback = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": str(e),
            "counts": {},
        }
        return api_error(message="Failed to fetch seed data status", code="SEED_STATUS_FAILED", details={"error": str(e)}, legacy=fallback)


@app.delete("/admin/diagnostics/logs", tags=["Admin Diagnostics"])
def clear_diagnostics_logs(admin: User = Depends(require_admin), database_session: Session = Depends(get_db)) -> Dict[str, str]:
    """Clear all diagnostic logs."""
    deleted_count = database_session.query(DiagnosticEvent).delete(synchronize_session=False)
    database_session.commit()
    diagnostic_logger.clear()
    log_diagnostic(
        DiagnosticLogType.INFO,
        "Diagnostic logs cleared by admin",
        details={"deleted_rows": int(deleted_count)},
        status_code=200,
        endpoint="/admin/diagnostics/logs"
    )
    response = {"status": "cleared", "timestamp": datetime.now(timezone.utc).isoformat(), "deleted_rows": int(deleted_count)}
    return api_success(data=response, message="Diagnostics logs cleared", legacy=response)


# ============================================================================
# END ADMIN DIAGNOSTICS ENDPOINTS
# ============================================================================


def _build_dashboard_assistant_context(
    database_session: Session,
    role: str,
    wallet_address: str | None = None,
    screen_scope: str = "dashboard",
    org_id: str | None = None,
) -> Dict[str, Any]:
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Build overview first (these metrics should stay available even if other queries fail).
    total_wallets = database_session.query(Wallet).filter(Wallet.organization_id == org_id).count() if org_id else database_session.query(Wallet).count()
    total_alerts = database_session.query(Alert).filter(Alert.organization_id == org_id).count() if org_id else database_session.query(Alert).count()
    critical_alerts = database_session.query(Alert).filter(Alert.severity == "CRITICAL", Alert.organization_id == org_id).count() if org_id else database_session.query(Alert).filter(Alert.severity == "CRITICAL").count()
    alerts_today = database_session.query(Alert).filter(Alert.detected_at >= today_start, Alert.organization_id == org_id).count() if org_id else database_session.query(Alert).filter(Alert.detected_at >= today_start).count()
    total_blocked = database_session.query(BlockedTransfer).filter(BlockedTransfer.organization_id == org_id).count() if org_id else database_session.query(BlockedTransfer).count()

    flow_7d: List[Dict[str, Any]] = []
    try:
        flow_rows = (
            database_session.query(
                func.date(Transaction.timestamp).label("date"),
                func.sum(Transaction.value).label("gross_value"),
                func.count(Transaction.id).label("tx_count"),
            )
            .filter(Transaction.timestamp >= seven_days_ago)
            .group_by(func.date(Transaction.timestamp))
            .order_by(func.date(Transaction.timestamp))
            .all()
        )
        flow_7d = [
            {
                "date": str(item.date) if item.date else None,
                "gross_value_eth": _eth_from_wei(int(item.gross_value or 0)),
                "tx_count": int(item.tx_count or 0),
            }
            for item in flow_rows
        ]
    except Exception as flow_error:
        logger.warning(f"Assistant flow_7d query failed: {flow_error}")

    top_risky_wallets_payload: List[Dict[str, Any]] = []
    try:
        top_risky_wallets = (
            database_session.query(Wallet)
            .order_by(Wallet.risk_score.desc())
            .limit(5)
            .all()
        )
        top_risky_wallets_payload = [
            {
                "address": wallet.address,
                "label": wallet.label,
                "risk_score": float(wallet.risk_score or 0),
                "account_status": wallet.account_status,
            }
            for wallet in top_risky_wallets
        ]
    except Exception as risky_error:
        logger.warning(f"Assistant top_risky_wallets query failed: {risky_error}")

    context: Dict[str, Any] = {
        "role": role,
        "screen_scope": screen_scope,
        "generated_at": now.isoformat(),
        "overview": {
            "total_wallets": total_wallets,
            "total_alerts": total_alerts,
            "critical_alerts": critical_alerts,
            "alerts_today": alerts_today,
            "total_blocked": total_blocked,
        },
        "flow_7d": flow_7d,
        "top_risky_wallets": top_risky_wallets_payload,
    }

    normalized_wallet = (wallet_address or "").lower().strip()
    if normalized_wallet:
        try:
            wallet = database_session.query(Wallet).filter(Wallet.address == normalized_wallet).first()
            wallet_tx_count = (
                database_session.query(func.count(Transaction.id))
                .filter((Transaction.from_address == normalized_wallet) | (Transaction.to_address == normalized_wallet))
                .scalar()
                or 0
            )
            wallet_alert_count = (
                database_session.query(func.count(Alert.id))
                .filter(Alert.wallet_address == normalized_wallet)
                .scalar()
                or 0
            )

            context["wallet_focus"] = {
                "address": normalized_wallet,
                "exists": wallet is not None,
                "risk_score": float(wallet.risk_score or 0.0) if wallet else 0.0,
                "account_status": wallet.account_status if wallet else None,
                "label": wallet.label if wallet else None,
                "transaction_count": int(wallet_tx_count),
                "alert_count": int(wallet_alert_count),
            }
        except Exception as wallet_focus_error:
            logger.warning(f"Assistant wallet_focus query failed: {wallet_focus_error}")
            context["wallet_focus"] = {
                "address": normalized_wallet,
                "exists": False,
                "risk_score": 0.0,
                "account_status": None,
                "label": None,
                "transaction_count": 0,
                "alert_count": 0,
            }

    return context


@app.post("/assistant/chat", tags=["Assistant"], summary="Chat with Sentinel Prime AI", description="Interactive AI assistant that answers questions about blockchain risk, system status, and compliance operational guidance based on real-time context.")
@limiter.limit("100/minute")
def assistant_chat(request: Request, payload: schemas.AssistantChatRequest, database_session: Session = Depends(get_db), current_user: Optional[User] = Depends(optional_auth)) -> Dict[str, Any]:
    message = payload.message.strip()
    role = payload.role
    wallet_address = payload.wallet_address
    screen_scope = payload.screen_scope
    conversation_history = payload.conversation_history or []
    ui_context = payload.context if isinstance(payload.context, dict) else {}

    if not message:
        log_diagnostic(
            DiagnosticLogType.API_ERROR,
            "Chat request missing message",
            status_code=400,
            endpoint="/assistant/chat"
        )
        raise HTTPException(status_code=400, detail="Missing message")

    if len(message) > 4000:
        raise HTTPException(status_code=400, detail="Message too long (max 4000 characters)")

    is_support_q = _is_account_support_question(message)
    is_system_q = _is_system_component_question(message)

    context = {}
    knowledge_snippets = []
    analyst = HFSecurityAnalyst()

    try:
        context = _build_enhanced_dashboard_context(
            database_session,
            role=role,
            wallet_address=wallet_address,
            screen_scope=screen_scope,
        )
        if ui_context:
            context["ui_context"] = ui_context
            if ui_context.get("dashboard_role"):
                context["dashboard_role"] = ui_context.get("dashboard_role")
            if ui_context.get("dashboard_feature_index") is not None:
                context["dashboard_feature_index"] = ui_context.get("dashboard_feature_index")
            if ui_context.get("dashboard_feature_label"):
                context["dashboard_feature_label"] = ui_context.get("dashboard_feature_label")
        log_diagnostic(
            DiagnosticLogType.API_CALL,
            "Assistant context built successfully",
            details={
                "role": role,
                "wallet_address": wallet_address,
                "scope": screen_scope,
                "overview": context.get("overview", {}),
                "flow_points": len(context.get("flow_7d", [])),
            },
            status_code=200,
            endpoint="/assistant/chat"
        )
    except Exception as e:
        logger.warning(f"Failed to build assistant context: {e}")
        log_diagnostic(
            DiagnosticLogType.API_ERROR,
            f"Failed to build assistant context: {str(e)}",
            details={"role": role, "error_type": type(e).__name__},
            status_code=500,
            endpoint="/assistant/chat"
        )
        context = {
            "role": role,
            "screen_scope": screen_scope,
            "overview": {
                "total_wallets": 0,
                "total_alerts": 0,
                "critical_alerts": 0,
                "alerts_today": 0,
                "total_blocked": 0,
            },
            "flow_7d": [],
            "top_risky_wallets": [],
        }

    try:
        knowledge_snippets = retrieve_relevant_snippets(
            message,
            role=role,
            wallet_address=wallet_address,
            scope=screen_scope,
            limit=4,
        )
        log_diagnostic(
            DiagnosticLogType.API_CALL,
            f"Retrieved {len(knowledge_snippets)} knowledge snippets",
            status_code=200,
            endpoint="/assistant/chat"
        )
    except Exception as e:
        logger.warning(f"Failed to retrieve knowledge snippets: {e}")
        log_diagnostic(
            DiagnosticLogType.API_ERROR,
            f"Failed to retrieve knowledge snippets: {str(e)}",
            status_code=500,
            endpoint="/assistant/chat"
        )
        knowledge_snippets = []

    question_intent = _detect_question_intent(message, context)

    if question_intent == "account_support":
        if analyst.enabled:
            answer = analyst.answer_general_question(
                question=message,
                context=context,
                knowledge_snippets=knowledge_snippets,
                conversation_history=conversation_history,
            )
            normalized_answer = _normalize_assistant_answer(answer)
        else:
            normalized_answer = None

        if not normalized_answer or _is_low_quality_answer(normalized_answer):
            normalized_answer = _build_dynamic_account_support_answer(message, context, database_session)
    elif question_intent == "dashboard_analytics":
        if analyst.enabled:
            answer = analyst.answer_dashboard_question(
                question=message,
                context=context,
                knowledge_snippets=knowledge_snippets,
                conversation_history=conversation_history,
            )
            normalized_answer = _normalize_assistant_answer(answer)
        else:
            normalized_answer = None

        if not normalized_answer or _is_low_quality_answer(normalized_answer):
            normalized_answer = _build_dynamic_dashboard_answer(message, context)
    elif question_intent == "operational_guidance":
        if analyst.enabled:
            answer = analyst.answer_general_question(
                question=message,
                context=context,
                knowledge_snippets=knowledge_snippets,
                conversation_history=conversation_history,
            )
            normalized_answer = _normalize_assistant_answer(answer)
        else:
            normalized_answer = None

        if not normalized_answer or _is_low_quality_answer(normalized_answer):
            normalized_answer = _build_operational_guidance_answer(message, context)
    else:
        if analyst.enabled:
            answer = analyst.answer_open_domain_question(
                question=message,
                knowledge_snippets=knowledge_snippets,
                conversation_history=conversation_history,
            )
            normalized_answer = _normalize_assistant_answer(answer)
        else:
            normalized_answer = None

        if not normalized_answer or _is_low_quality_answer(normalized_answer):
            if _is_system_component_question(message):
                normalized_answer = _build_system_component_answer(message, database_session)
            else:
                normalized_answer = analyst._fallback_general_answer(  # noqa: SLF001
                    question=message,
                    context=context,
                    conversation_history=conversation_history,
                    knowledge_snippets=knowledge_snippets,
                )

    raw_knowledge_sources = [
        {"source": snippet.source, "heading": snippet.heading, "score": snippet.score}
        for snippet in knowledge_snippets
    ]
    seen_knowledge = set()
    deduplicated_knowledge_sources = []
    for item in raw_knowledge_sources:
        key = (str(item.get("source", "")).strip(), str(item.get("heading", "")).strip())
        if key in seen_knowledge:
            continue
        seen_knowledge.add(key)
        deduplicated_knowledge_sources.append(item)

    sources = [
        "overview: wallets/alerts/blocked_transfers",
        "flow_7d: transactions",
        "top_risky_wallets: wallets",
    ]
    if wallet_address:
        sources.append("wallet_focus: wallets/transactions/alerts")
    deduped_sources = _dedupe_preserve_order(sources)

    response = {
        "answer": normalized_answer,
        "context": {
            "role": role,
            "screen_scope": screen_scope,
            "overview": context.get("overview", {}) if isinstance(context, dict) else {},
            "top_risky_wallets": context.get("top_risky_wallets", []) if isinstance(context, dict) else [],
            "wallet_focus": context.get("wallet_focus") if isinstance(context, dict) else None,
        },
        "sources": deduped_sources,
        "knowledge_sources": deduplicated_knowledge_sources,
        "model_enabled": analyst.enabled,
    }

    log_diagnostic(
        DiagnosticLogType.API_CALL,
        "Chat response prepared successfully",
        status_code=200,
        endpoint="/assistant/chat"
    )
    return response





@app.get("/alerts/recent", tags=["Alerts"])
def get_recent_alerts(
    limit: int = 50,
    severity: str | None = None,
    search: str | None = None,
    chain: str = Query(default="ethereum"),
    database_session: Session = Depends(get_db),
    current_user: Optional[User] = Depends(optional_auth),
) -> Dict[str, Any]:
    """
    Retrieve recent security alerts with optional filtering.

    Args:
        limit: Maximum number of alerts to return
        severity: Filter by severity (CRITICAL, HIGH, MEDIUM, LOW)
        search: Search by wallet_address, alert_type, or message
        database_session: Database session dependency

    Returns:
        Dictionary containing filtered alerts list and statistics
    """
    from datetime import timedelta

    # Normalize chain parameter
    try:
        canonical_chain = _normalize_chain_name(chain)
    except HTTPException as e:
        raise e

    query = database_session.query(Alert).order_by(Alert.detected_at.desc())

    # Apply chain filter
    query = query.filter(Alert.chain_id == canonical_chain)

    # Apply severity filter
    if severity and severity.upper() != "ALL":
        query = query.filter(Alert.severity == severity.upper())

    # Apply search filter
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            (Alert.wallet_address.ilike(search_term)) |
            (Alert.alert_type.ilike(search_term)) |
            (Alert.message.ilike(search_term))
        )

    # Get total count before limit
    total_count = query.count()

    # Apply limit
    recent_alerts = query.limit(limit).all()

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    alerts_today = database_session.query(Alert).filter(
        Alert.detected_at >= today_start
    ).count()

    critical_alerts = database_session.query(Alert).filter(
        Alert.severity == "CRITICAL"
    ).count()

    return {
        "alerts": [
            {
                "alert_id": str(alert.id),
                "wallet_address": alert.wallet_address,
                "alert_type": alert.alert_type,
                "severity": alert.severity,
                "message": alert.message,
                "risk_score": alert.risk_score,
                "context": alert.alert_metadata or {},
                "detected_at": alert.detected_at.isoformat(),
                "acknowledged": bool(alert.acknowledged)
            }
            for alert in recent_alerts
        ],
        "statistics": {
            "total_alerts_today": alerts_today,
            "critical_count": critical_alerts,
            "total_matching": total_count,
            "returned_count": len(recent_alerts)
        }
    }


@app.get("/alerts/latest", tags=["Alerts"])
def get_latest_alerts(
    limit: int = 5,
    database_session: Session = Depends(get_db),
    current_user: Optional[User] = Depends(optional_auth),
) -> Dict[str, Any]:
    """
    Retrieve latest security alerts for real-time ticker display.

    Optimized endpoint for polling - returns minimal data frequently.

    Args:
        limit: Maximum number of alerts to return (default: 5)
        database_session: Database session dependency

    Returns:
        Dictionary containing latest alerts list
    """
    latest_alerts = database_session.query(Alert).order_by(
        Alert.detected_at.desc()
    ).limit(limit).all()

    return {
        "alerts": [
            {
                "id": str(alert.id),
                "wallet_address": alert.wallet_address or "",  # Return FULL address

                "alert_type": alert.alert_type,
                "severity": alert.severity,
                "message": alert.message,
                "risk_score": alert.risk_score,
                "metadata": alert.alert_metadata,
                "detected_at": alert.detected_at.isoformat()
            }
            for alert in latest_alerts
        ],
        "count": len(latest_alerts),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/wallet/{wallet_address}/balance", tags=["Wallet"])
@app.get("/balance/{wallet_address}", tags=["Wallet"])
@app.get("/_legacy_/wallet/{wallet_address}/balance", tags=["Wallet"])
def get_wallet_balance(wallet_address: str, database_session: Session = Depends(get_db), current_user: Optional[User] = Depends(optional_auth)) -> Dict[str, Any]:
    """Return balance computed from transactions table (in - out)."""
    normalized_address = _validate_ethereum_address(wallet_address)
    wallet = _get_or_create_wallet(database_session, normalized_address)

    received_wei = (
        database_session.query(func.coalesce(func.sum(Transaction.value), 0))
        .filter(Transaction.to_address == normalized_address)
        .scalar()
    )
    sent_wei = (
        database_session.query(func.coalesce(func.sum(Transaction.value), 0))
        .filter(Transaction.from_address == normalized_address)
        .scalar()
    )
    balance_wei = int(received_wei or 0) - int(sent_wei or 0)

    return {
        "address": normalized_address,
        "balance_wei": balance_wei,
        "balance_eth": _eth_from_wei(balance_wei),
        "risk_score": wallet.risk_score,
        "total_transactions": int(wallet.total_transactions or 0)
    }


@app.get("/transactions/{wallet_address}", tags=["Transaction"])
@app.get("/wallet/{wallet_address}/transactions", tags=["Transaction"])
def get_wallet_transactions(
    wallet_address: str,
    limit: int = 20,
    chain: str = Query("ethereum"),
    database_session: Session = Depends(get_db),
    current_user: Optional[User] = Depends(optional_auth),
) -> Dict[str, Any]:
    """Return recent transactions for a wallet from DB (fallback to Alchemy fetch+persist)."""
    normalized_address = _validate_ethereum_address(wallet_address)

    # Try DB first
    txs = (
        database_session.query(Transaction)
        .filter(
            ((Transaction.from_address == normalized_address) | (Transaction.to_address == normalized_address)) &
            (Transaction.chain_id == chain)
        )
        .order_by(Transaction.timestamp.desc().nullslast(), Transaction.created_at.desc())
        .limit(limit)
        .all()
    )

    # If empty, fetch from Alchemy and persist
    if not txs:
        history = fetch_wallet_history(normalized_address, chain=chain, max_count=max(limit, 50))
        if history:
            _persist_blockchain_data(database_session, history, normalized_address)
            txs = (
                database_session.query(Transaction)
                .filter((Transaction.from_address == normalized_address) | (Transaction.to_address == normalized_address))
                .order_by(Transaction.timestamp.desc().nullslast(), Transaction.created_at.desc())
                .limit(limit)
                .all()
            )

    return api_success(data={
        "address": normalized_address,
        "count": len(txs),
        "transactions": [
            {
                "id": str(tx.id),
                "tx_hash": tx.tx_hash,
                "from_address": tx.from_address,
                "to_address": tx.to_address,
                "value_wei": int(tx.value or 0),
                "value_eth": _eth_from_wei(int(tx.value or 0)),
                "timestamp": tx.timestamp.isoformat() if tx.timestamp else None,
                "status": int(tx.status or 1),
                "is_flagged": bool(tx.is_flagged),
                "flag_reason": tx.flag_reason,
                "gas_price": str(tx.gas_price or 0),
                "gas_used": int(tx.gas_used or 0),
                "block_number": int(tx.block_number or 0)
            }
            for tx in txs
        ]
    }, legacy={
        "address": normalized_address,
        "count": len(txs),
        "transactions": [
            {
                "id": str(tx.id),
                "tx_hash": tx.tx_hash,
                "from_address": tx.from_address,
                "to_address": tx.to_address,
                "value_wei": int(tx.value or 0),
                "value_eth": _eth_from_wei(int(tx.value or 0)),
                "timestamp": tx.timestamp.isoformat() if tx.timestamp else None,
                "status": int(tx.status or 1),
                "is_flagged": bool(tx.is_flagged),
                "flag_reason": tx.flag_reason,
                "gas_price": str(tx.gas_price or 0),
                "gas_used": int(tx.gas_used or 0),
                "block_number": int(tx.block_number or 0)
            }
            for tx in txs
        ]
    })

@app.post("/transfer/protected", tags=["Transaction"])
def protected_transfer(
    payload: ProtectedTransferRequest,
    database_session: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> Dict[str, Any]:
    """
    Protected transfer endpoint with wallet ID validation and AI risk assessment.

    Supports 3-strike warning system:
    - Risk 0-50: Auto-approve
    - Risk 50-80: Require user confirmation
    - Risk >80 or blacklisted: Block immediately

    Args:
        from_wallet_id: Source wallet ID
        to_wallet_id: Destination wallet ID
        to_address: Destination Ethereum address
        amount_eth: Amount in ETH
        confirm_risk: User acknowledged the risk (for 50-80 case)
    """
    from_wallet_id = payload.from_wallet_id.strip()
    to_wallet_id = payload.to_wallet_id.strip()
    to_address = payload.to_address.lower().strip()
    amount_eth = payload.amount_eth
    confirm_risk = payload.confirm_risk

    # Validate inputs
    if not from_wallet_id or not to_wallet_id or amount_eth <= 0:
        raise HTTPException(
            status_code=400,
            detail="from_wallet_id, to_wallet_id, and amount_eth are required"
        )

    # Rate limiting check
    from app.services.rate_limiter import check_transfer_rate_limit, record_transfer
    rate_allowed, rate_error, retry_after = check_transfer_rate_limit(from_wallet_id)
    if not rate_allowed:
        raise HTTPException(
            status_code=429,
            detail=rate_error,
            headers={"Retry-After": str(retry_after)} if retry_after else None
        )

    # Helper function to find wallet by ID or address
    def find_wallet(identifier: str):
        # Try as UUID first
        try:
            import uuid as uuid_module
            wallet_id = uuid_module.UUID(identifier)
            wallet = database_session.query(Wallet).filter(Wallet.id == wallet_id).first()
            if wallet:
                return wallet
        except (ValueError, AttributeError):
            pass
        # Try as address (0x...)
        normalized = identifier.lower().strip()
        return database_session.query(Wallet).filter(Wallet.address == normalized).first()

    # Get source wallet by ID or address
    from_wallet = find_wallet(from_wallet_id)
    if not from_wallet:
        raise HTTPException(status_code=404, detail="Source wallet not found")

    sender = from_wallet.address

    # Check if sender is suspended
    if from_wallet.account_status == 'suspended':
        raise HTTPException(
            status_code=403,
            detail="Your account is suspended due to multiple risk warnings. Contact support."
        )

    # Get destination wallet by ID or address
    to_wallet = find_wallet(to_wallet_id)
    if not to_wallet:
        # If wallet not found in DB, use to_address or to_wallet_id as the receiver address
        receiver_address = to_address if to_address else to_wallet_id.lower().strip()
        # Create a new wallet record for this address
        if receiver_address.startswith('0x') and len(receiver_address) == 42:
            to_wallet = Wallet(address=receiver_address, entity_type='Unknown', account_status='active')
            database_session.add(to_wallet)
            database_session.commit()
            database_session.refresh(to_wallet)
        else:
            raise HTTPException(status_code=404, detail="Destination wallet not found and invalid address format")

    receiver = to_wallet.address

    # Get sender's current warning count
    warning_count = database_session.query(UserWarning).filter(
        UserWarning.wallet_address == sender
    ).count()

    # Check receiver risk
    blacklist_record = database_session.query(Blacklist).filter(
        Blacklist.address == receiver
    ).first()

    receiver_risk = float(to_wallet.risk_score or 0)
    receiver_status = to_wallet.account_status

    # If receiver has no risk score or outdated data, run AI analysis
    if receiver_risk == 0 or to_wallet.risk_score is None:
        try:
            # Fetch fresh blockchain data and run AI analysis
            tx_history = fetch_wallet_history(receiver, max_count=100)
            ai_engine = MultiAgentDetectionEngine(database_session=database_session)
            risk_analysis = ai_engine.analyze_wallet(wallet_address=receiver, transactions=tx_history)
            receiver_risk = float(risk_analysis["total_score"])

            # Update wallet with new risk score
            to_wallet.risk_score = receiver_risk
            to_wallet.last_activity_at = datetime.now(timezone.utc)

            # Auto-update status based on risk
            if receiver_risk >= 90:
                to_wallet.account_status = 'frozen'
                to_wallet.risk_category = risk_analysis.get("highest_category", "scam")
            elif receiver_risk >= 70:
                to_wallet.account_status = 'suspended'
                to_wallet.risk_category = risk_analysis.get("highest_category", "manipulation")
            elif receiver_risk >= 50:
                to_wallet.account_status = 'under_review'

            database_session.commit()
            receiver_status = to_wallet.account_status
            logger.info(f"Real-time AI analysis for {receiver}: risk={receiver_risk}%")
        except Exception as e:
            logger.warning(f"AI analysis failed for {receiver}: {e}")
            # Continue with cached/default risk

    if blacklist_record:
        receiver_risk = 100.0
        receiver_status = "blacklisted"

    # Critical risk (>80 or blacklisted) - Block immediately
    if receiver_risk >= 80 or blacklist_record or receiver_status in ['frozen', 'suspended']:
        # Record blocked transfer
        blocked = BlockedTransfer(
            sender_address=sender,
            receiver_address=receiver,
            amount=_wei_from_eth(amount_eth),
            risk_score=receiver_risk,
            block_reason="high_risk_receiver",
            user_warning_count=warning_count
        )
        database_session.add(blocked)
        database_session.commit()

        return {
            "status": "blocked",
            "requires_confirmation": False,
            "receiver_risk": receiver_risk,
            "message": f"Transfer blocked: Receiver is high-risk (score: {receiver_risk}%)",
            "block_reason": receiver_status if receiver_status != "unknown" else "high_risk"
        }

    # Medium risk (50-80) - Show warning if not confirmed
    if receiver_risk >= 50 and not confirm_risk:
        return {
            "status": "warning",
            "requires_confirmation": True,
            "receiver_risk": receiver_risk,
            "current_warnings": warning_count,
            "max_warnings": 3,
            "message": f"⚠️ This wallet has a risk score of {receiver_risk}%. Are you sure you want to proceed?",
            "warning_text": f"You have {3 - warning_count} warnings remaining before account suspension."
        }

    # User chose to proceed despite warning
    if confirm_risk and receiver_risk >= 50:
        # Record warning
        new_warning = UserWarning(
            wallet_address=sender,
            target_address=receiver,
            warning_type="RISK_IGNORED",
            risk_score=receiver_risk,
            user_action="ignored",
            warning_number=warning_count + 1
        )
        database_session.add(new_warning)
        warning_count += 1

        # Check if 3 strikes reached
        if warning_count >= 3:
            from_wallet.account_status = 'suspended'
            from_wallet.flagged_at = datetime.now(timezone.utc)
            from_wallet.flagged_by = 'SYSTEM_AUTO_SUSPEND'
            from_wallet.notes = f"{from_wallet.notes or ''}\n[{datetime.now(timezone.utc).isoformat()}] Auto-suspended after 3 risk warnings."

            # Create alert for admin
            suspend_alert = Alert(
                wallet_address=sender,
                alert_type="USER_SUSPENDED",
                severity="HIGH",
                message=f"User account auto-suspended after ignoring 3 risk warnings. Last attempted transfer to {receiver}.",
                risk_score=receiver_risk,
                alert_metadata={
                    "warning_count": warning_count,
                    "last_target": receiver,
                    "last_risk": receiver_risk
                }
            )
            database_session.add(suspend_alert)
            database_session.commit()

            return {
                "status": "blocked",
                "suspended": True,
                "message": "Account suspended after 3 ignored risk warnings",
                "warning_count": warning_count
            }

        database_session.commit()

    # Proceed with transaction (low risk or user accepted warning)
    amount_wei = _wei_from_eth(amount_eth)

    # Check balance
    sender_received_wei = database_session.query(
        func.coalesce(func.sum(Transaction.value), 0)
    ).filter(Transaction.to_address == sender).scalar()

    sender_sent_wei = database_session.query(
        func.coalesce(func.sum(Transaction.value), 0)
    ).filter(Transaction.from_address == sender).scalar()

    sender_balance_wei = int(sender_received_wei or 0) - int(sender_sent_wei or 0)

    if sender_balance_wei < amount_wei:
        return {
            "status": "blocked",
            "message": f"Insufficient balance. Available: {_eth_from_wei(sender_balance_wei)} ETH",
            "available_balance": _eth_from_wei(sender_balance_wei)
        }

    # Create transaction
    import uuid as uuid_module
    tx_hash = f"sim_{uuid_module.uuid4().hex}"
    tx = Transaction(
        tx_hash=tx_hash,
        from_address=sender,
        to_address=receiver,
        value=amount_wei,
        block_number=0,
        timestamp=datetime.now(timezone.utc),
        gas_price=0,
        gas_used=0,
        input_data="0x",
        status=1
    )
    database_session.add(tx)

    # Update wallets
    from_wallet.total_value_sent = int(from_wallet.total_value_sent or 0) + amount_wei
    from_wallet.total_transactions = int(from_wallet.total_transactions or 0) + 1
    from_wallet.last_activity_at = datetime.now(timezone.utc)

    to_wallet.total_value_received = int(to_wallet.total_value_received or 0) + amount_wei
    to_wallet.total_transactions = int(to_wallet.total_transactions or 0) + 1
    to_wallet.last_activity_at = datetime.now(timezone.utc)

    database_session.commit()

    # Calculate new balance
    new_balance_wei = sender_balance_wei - amount_wei

    return {
        "status": "success",
        "tx_hash": tx_hash,
        "from": sender,
        "to": receiver,
        "amount_eth": amount_eth,
        "receiver_risk_score": receiver_risk,
        "warning_count": warning_count,
        "sender_balance_eth": _eth_from_wei(new_balance_wei),
        "message": "Transaction completed successfully" + (f" (Warning #{warning_count} recorded)" if confirm_risk and receiver_risk >= 50 else "")
    }


@app.post("/send", tags=["Transaction"])
def send_eth(
    payload: SendEthRequest,
    database_session: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> Dict[str, Any]:
    """Simulate send ETH with real risk check and DB-ledger updates (no on-chain transfer)."""
    sender = payload.sender.lower().strip()
    receiver = payload.receiver.lower().strip()
    amount = payload.amount

    if not sender or not receiver:
        raise HTTPException(status_code=400, detail="sender and receiver are required")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    def _record_block_alert(reason: str, risk_score: float | None = None) -> None:
        try:
            alert = Alert(
                wallet_address=receiver,
                alert_type="BLOCKED_TRANSFER",
                severity="HIGH",
                message=f"Blocked transfer attempt from {sender} to {receiver}: {reason}",
                risk_score=risk_score,
                alert_metadata={
                    "sender": sender,
                    "receiver": receiver,
                    "amount": amount,
                    "reason": reason,
                },
                detected_at=datetime.now(timezone.utc),
            )
            database_session.add(alert)
            database_session.commit()
        except Exception:
            database_session.rollback()

    # Block immediately if receiver is blacklisted (canonical rule).
    blacklist_record = database_session.query(Blacklist).filter(Blacklist.address == receiver).first()
    if blacklist_record:
        _record_block_alert("blacklisted")
        raise HTTPException(status_code=403, detail="Receiver blocked (blacklisted)")

    # Block if receiver has a recent scanner alert.
    latest_receiver_alert = (
        database_session.query(Alert)
        .filter(Alert.wallet_address == receiver)
        .order_by(Alert.detected_at.desc())
        .first()
    )
    if latest_receiver_alert and float(latest_receiver_alert.risk_score or 0.0) >= 80:
        _record_block_alert(
            "recent alert",
            risk_score=float(latest_receiver_alert.risk_score or 0.0),
        )
        raise HTTPException(
            status_code=403,
            detail=f"Receiver blocked (alert risk={float(latest_receiver_alert.risk_score or 0.0)})"
        )

    # Block immediately if receiver already has a high persisted risk score.
    existing_receiver_wallet = database_session.query(Wallet).filter(Wallet.address == receiver).first()
    if existing_receiver_wallet and float(existing_receiver_wallet.risk_score or 0.0) >= 80:
        _record_block_alert("cached wallet risk", risk_score=float(existing_receiver_wallet.risk_score or 0.0))
        raise HTTPException(
            status_code=403,
            detail=f"Receiver blocked (cached risk={float(existing_receiver_wallet.risk_score or 0.0)})"
        )

    # Run risk analysis for receiver using fresh chain data
    tx_history = fetch_wallet_history(receiver, max_count=100)
    ai_engine = MultiAgentDetectionEngine(database_session=database_session)
    risk_analysis = ai_engine.analyze_wallet(wallet_address=receiver, transactions=tx_history)
    receiver_risk = float(risk_analysis.get("total_score", 0.0))
    receiver_level = str(risk_analysis.get("risk_level", "LOW"))

    # Block policy (server-side, canonical)
    if receiver_level in {"HIGH", "CRITICAL"} or receiver_risk >= 80:
        _record_block_alert(f"live risk level={receiver_level}", risk_score=receiver_risk)
        raise HTTPException(status_code=403, detail=f"Receiver blocked (risk={receiver_risk}, level={receiver_level})")

    sender_wallet = _get_or_create_wallet(database_session, sender)
    receiver_wallet = _get_or_create_wallet(database_session, receiver)

    amount_wei = _wei_from_eth(amount)
    sender_received_wei = (
        database_session.query(func.coalesce(func.sum(Transaction.value), 0))
        .filter(Transaction.to_address == sender)
        .scalar()
    )
    sender_sent_wei = (
        database_session.query(func.coalesce(func.sum(Transaction.value), 0))
        .filter(Transaction.from_address == sender)
        .scalar()
    )
    sender_balance_wei = int(sender_received_wei or 0) - int(sender_sent_wei or 0)
    if sender_balance_wei < amount_wei:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    # Update internal ledger stats
    sender_wallet.total_value_sent = int(sender_wallet.total_value_sent or 0) + amount_wei
    sender_wallet.total_transactions = int(sender_wallet.total_transactions or 0) + 1
    sender_wallet.last_activity_at = datetime.now(timezone.utc)

    receiver_wallet.total_value_received = int(receiver_wallet.total_value_received or 0) + amount_wei
    receiver_wallet.total_transactions = int(receiver_wallet.total_transactions or 0) + 1
    receiver_wallet.last_activity_at = datetime.now(timezone.utc)
    receiver_wallet.risk_score = receiver_risk

    # Record a simulated tx into transactions table
    import uuid
    tx_hash = f"sim_{uuid.uuid4().hex}"
    tx = Transaction(
        tx_hash=tx_hash,
        from_address=sender,
        to_address=receiver,
        value=amount_wei,
        block_number=0,
        timestamp=datetime.now(timezone.utc),
        gas_price=0,
        gas_used=0,
        input_data="0x",
        status=1
    )
    database_session.add(tx)
    database_session.commit()

    # Recompute post-tx balance from transactions table
    sender_received_wei = (
        database_session.query(func.coalesce(func.sum(Transaction.value), 0))
        .filter(Transaction.to_address == sender)
        .scalar()
    )
    sender_sent_wei = (
        database_session.query(func.coalesce(func.sum(Transaction.value), 0))
        .filter(Transaction.from_address == sender)
        .scalar()
    )
    new_sender_balance_wei = int(sender_received_wei or 0) - int(sender_sent_wei or 0)
    return {
        "status": "success",
        "tx_hash": tx_hash,
        "from": sender,
        "to": receiver,
        "amount_eth": amount,
        "amount_wei": amount_wei,
        "receiver_risk_score": receiver_risk,
        "receiver_risk_level": receiver_level,
        "sender_balance_wei": new_sender_balance_wei,
        "sender_balance_eth": _eth_from_wei(new_sender_balance_wei)
    }


# ==========================================
# ADMIN DASHBOARD ENDPOINTS
# ==========================================

@app.get("/wallets", tags=["Admin - Wallets"])
def get_all_wallets(
    current_user: User = Depends(admin_or_analyst),
    status: str = None,
    account_status: str = None,  # Alias for status (frontend uses this)
    risk_category: str = None,
    min_risk: float = None,
    min_risk_score: float = None,  # Alias for min_risk (frontend uses this)
    limit: int = 100,
    database_session: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get all monitored wallets with optional filtering.

    Args:
        status: Filter by account_status (active, suspended, frozen, under_review)
        account_status: Alias for status parameter
        risk_category: Filter by risk_category (money_laundering, manipulation, scam)
        min_risk: Minimum risk score filter
        min_risk_score: Alias for min_risk parameter
        limit: Maximum results to return
    """
    query = database_session.query(Wallet)

    # Support both parameter names
    actual_status = status or account_status
    actual_min_risk = min_risk if min_risk is not None else min_risk_score

    if actual_status:
        query = query.filter(Wallet.account_status == actual_status)
    if risk_category:
        query = query.filter(Wallet.risk_category == risk_category)
    if actual_min_risk is not None:
        query = query.filter(Wallet.risk_score >= actual_min_risk)

    wallets = query.order_by(Wallet.risk_score.desc()).limit(limit).all()

    # Get statistics
    total_wallets = database_session.query(Wallet).count()
    high_risk_count = database_session.query(Wallet).filter(Wallet.risk_score >= 80).count()
    suspended_count = database_session.query(Wallet).filter(Wallet.account_status == 'suspended').count()
    frozen_count = database_session.query(Wallet).filter(Wallet.account_status == 'frozen').count()

    return {
        "wallets": [
            {
                "id": str(w.id),
                "address": w.address,
                "label": w.label,
                "entity_type": w.entity_type,
                "account_status": w.account_status,
                "risk_score": float(w.risk_score or 0),
                "risk_category": w.risk_category,
                "total_transactions": int(w.total_transactions or 0),
                "first_seen_at": w.first_seen_at.isoformat() if w.first_seen_at else None,
                "last_activity_at": w.last_activity_at.isoformat() if w.last_activity_at else None,
                "flagged_at": w.flagged_at.isoformat() if w.flagged_at else None,
                "notes": w.notes
            }
            for w in wallets
        ],
        "statistics": {
            "total_wallets": total_wallets,
            "high_risk_count": high_risk_count,
            "suspended_count": suspended_count,
            "frozen_count": frozen_count
        },
        "count": len(wallets)
    }


@app.put("/wallet/{wallet_address}/status", tags=["Admin - Wallets"])
@app.put("/wallets/{wallet_address}/status", tags=["Admin - Wallets"])
def update_wallet_status(
    wallet_address: str,
    payload: UpdateWalletStatusRequest,
    admin: User = Depends(require_admin),
    database_session: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Update wallet account status (active, suspended, frozen, under_review).

    Args:
        wallet_address: Target wallet address
        payload: { "status": "suspended", "reason": "...", "admin_id": "..." }
    """
    normalized_address = _validate_ethereum_address(wallet_address)
    new_status = payload.status.lower()
    reason = payload.reason
    admin_id = payload.admin_id

    valid_statuses = ["active", "suspended", "frozen", "under_review"]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    wallet = database_session.query(Wallet).filter(Wallet.address == normalized_address).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    old_status = wallet.account_status
    wallet.account_status = new_status
    wallet.flagged_at = datetime.now(timezone.utc) if new_status in ["suspended", "frozen"] else wallet.flagged_at
    wallet.flagged_by = admin_id if new_status in ["suspended", "frozen"] else wallet.flagged_by
    wallet.notes = f"{wallet.notes or ''}\n[{datetime.now(timezone.utc).isoformat()}] Status changed: {old_status} -> {new_status}. Reason: {reason}"
    wallet.updated_at = datetime.now(timezone.utc)

    # Create audit log
    audit_log = AuditLog(
        action_type="WALLET_STATUS_CHANGE",
        entity_type="wallet",
        entity_id=wallet.id,
        user_identifier=admin_id,
        details={
            "old_status": old_status,
            "new_status": new_status,
            "reason": reason,
            "wallet_address": normalized_address
        }
    )
    database_session.add(audit_log)

    # Create alert for status change
    alert = Alert(
        wallet_address=normalized_address,
        alert_type="STATUS_CHANGED",
        severity="MEDIUM" if new_status == "under_review" else "HIGH",
        message=f"Wallet status changed from {old_status} to {new_status}. Reason: {reason}",
        risk_score=wallet.risk_score,
        alert_metadata={"old_status": old_status, "new_status": new_status, "changed_by": admin_id}
    )
    database_session.add(alert)

    database_session.commit()

    return {
        "success": True,
        "wallet_address": normalized_address,
        "old_status": old_status,
        "new_status": new_status,
        "updated_at": wallet.updated_at.isoformat()
    }


@app.get("/wallet/{wallet_address}/stats", tags=["Admin - Tracking"])
@app.get("/wallets/{wallet_address}/stats", tags=["Admin - Tracking"])
def get_wallet_stats(
    wallet_address: str,
    database_session: Session = Depends(get_db),
    current_user: User = Depends(admin_or_analyst),
) -> Dict[str, Any]:
    """
    Get detailed wallet statistics including ETH sent/received.
    """
    normalized_address = _validate_ethereum_address(wallet_address)

    # Calculate total ETH sent
    sent_result = database_session.query(
        func.sum(Transaction.value).label('total_sent'),
        func.count(Transaction.id).label('sent_count')
    ).filter(
        Transaction.from_address == normalized_address
    ).first()

    # Calculate total ETH received
    received_result = database_session.query(
        func.sum(Transaction.value).label('total_received'),
        func.count(Transaction.id).label('received_count')
    ).filter(
        Transaction.to_address == normalized_address
    ).first()

    total_sent_wei = int(sent_result.total_sent or 0) if sent_result else 0
    total_received_wei = int(received_result.total_received or 0) if received_result else 0
    sent_count = sent_result.sent_count or 0 if sent_result else 0
    received_count = received_result.received_count or 0 if received_result else 0

    # Get wallet info
    wallet = database_session.query(Wallet).filter(Wallet.address == normalized_address).first()

    stats_data = {
        "address": normalized_address,
        "eth_sent": _eth_from_wei(total_sent_wei),
        "eth_received": _eth_from_wei(total_received_wei),
        "eth_balance": _eth_from_wei(total_received_wei - total_sent_wei),
        "sent_count": sent_count,
        "received_count": received_count,
        "total_transactions": sent_count + received_count,
        "wallet_info": {
            "label": wallet.label if wallet else None,
            "entity_type": wallet.entity_type if wallet else "Unknown",
            "risk_score": float(wallet.risk_score or 0) if wallet else 0,
            "account_status": wallet.account_status if wallet else None
        } if wallet else None
    }

    return api_success(
        data=stats_data,
        message=f"Wallet stats for {normalized_address} fetched successfully",
        legacy=stats_data
    )


@app.get("/wallets/{wallet_address}/transactions", tags=["Admin - Tracking"])
def get_admin_wallet_transactions(
    wallet_address: str,
    limit: int = 50,
    database_session: Session = Depends(get_db),
    current_user: User = Depends(admin_or_analyst),
) -> Dict[str, Any]:
    """
    Get transaction history for a wallet.
    """
    normalized_address = _validate_ethereum_address(wallet_address)

    # Get all transactions involving this wallet
    transactions = database_session.query(Transaction).filter(
        (Transaction.from_address == normalized_address) |
        (Transaction.to_address == normalized_address)
    ).order_by(Transaction.timestamp.desc()).limit(limit).all()

    tx_list = []
    for tx in transactions:
        direction = "sent" if tx.from_address == normalized_address else "received"
        counterparty = tx.to_address if direction == "sent" else tx.from_address

        # Get counterparty wallet info
        counterparty_wallet = database_session.query(Wallet).filter(
            Wallet.address == counterparty
        ).first()

        tx_list.append({
            "tx_hash": tx.tx_hash,
            "direction": direction,
            "counterparty": counterparty,
            "counterparty_label": counterparty_wallet.label if counterparty_wallet else None,
            "counterparty_risk": float(counterparty_wallet.risk_score or 0) if counterparty_wallet else 0,
            "value_eth": _eth_from_wei(int(tx.value or 0)),
            "block_number": tx.block_number,
            "timestamp": tx.timestamp.isoformat() if tx.timestamp else None,
            "is_flagged": tx.is_flagged,
            "flag_reason": tx.flag_reason
        })

    response_data = {
        "address": normalized_address,
        "transactions": tx_list,
        "count": len(tx_list)
    }

    return api_success(
        data=response_data,
        message=f"Wallet transactions for {normalized_address} fetched successfully",
        legacy=response_data
    )





@app.get("/wallet/{wallet_address}/connections", tags=["Admin - Tracking"])
@app.get("/wallets/{wallet_address}/connections", tags=["Admin - Tracking"])
def get_wallet_connections(
    wallet_address: str,
    database_session: Session = Depends(get_db),
    current_user: User = Depends(admin_or_analyst),
) -> Dict[str, Any]:
    """
    Get all wallet connections (who this wallet interacted with).
    Used for the tracking page to show relationship graph.
    """
    normalized_address = _validate_ethereum_address(wallet_address)

    # Get wallets this address sent to
    sent_to = database_session.query(
        Transaction.to_address,
        func.count(Transaction.id).label('tx_count'),
        func.sum(Transaction.value).label('total_value')
    ).filter(
        Transaction.from_address == normalized_address
    ).group_by(Transaction.to_address).all()

    # Get wallets this address received from
    received_from = database_session.query(
        Transaction.from_address,
        func.count(Transaction.id).label('tx_count'),
        func.sum(Transaction.value).label('total_value')
    ).filter(
        Transaction.to_address == normalized_address
    ).group_by(Transaction.from_address).all()

    # Enrich with wallet info
    connections = []
    for addr, tx_count, total_value in sent_to:
        if not addr:
            continue
        wallet_info = database_session.query(Wallet).filter(Wallet.address == addr).first()
        connections.append({
            "address": addr,
            "direction": "outgoing",
            "tx_count": tx_count,
            "total_value_eth": _eth_from_wei(int(total_value or 0)),
            "label": wallet_info.label if wallet_info else None,
            "entity_type": wallet_info.entity_type if wallet_info else "Unknown",
            "risk_score": float(wallet_info.risk_score or 0) if wallet_info else 0,
            "account_status": wallet_info.account_status if wallet_info else None
        })

    for addr, tx_count, total_value in received_from:
        if not addr:
            continue
        wallet_info = database_session.query(Wallet).filter(Wallet.address == addr).first()
        connections.append({
            "address": addr,
            "direction": "incoming",
            "tx_count": tx_count,
            "total_value_eth": _eth_from_wei(int(total_value or 0)),
            "label": wallet_info.label if wallet_info else None,
            "entity_type": wallet_info.entity_type if wallet_info else "Unknown",
            "risk_score": float(wallet_info.risk_score or 0) if wallet_info else 0,
            "account_status": wallet_info.account_status if wallet_info else None
        })

    # Get main wallet info
    main_wallet = database_session.query(Wallet).filter(Wallet.address == normalized_address).first()

    response_data = {
        "wallet": {
            "address": normalized_address,
            "label": main_wallet.label if main_wallet else None,
            "risk_score": float(main_wallet.risk_score or 0) if main_wallet else 0,
            "entity_type": main_wallet.entity_type if main_wallet else "Unknown",
            "account_status": main_wallet.account_status if main_wallet else None
        },
        "connections": connections,
        "total_connections": len(connections)
    }

    return api_success(
        data=response_data,
        message=f"Wallet connections for {normalized_address} fetched successfully",
        legacy=response_data
    )


@app.get("/blocked-transfers", tags=["Admin - History"])
def get_blocked_transfers(
    current_user: User = Depends(admin_or_analyst),
    limit: int = 100,
    search: str | None = None,
    min_risk: float | None = None,
    chain: str = Query(default="ethereum"),
    database_session: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get history of all blocked transfers with optional filtering.

    Args:
        limit: Maximum number to return
        search: Search by sender or receiver address
        min_risk: Minimum risk score filter
    """
    limit = max(1, min(int(limit or 100), 500))

    try:
        # Normalize chain parameter
        try:
            canonical_chain = _normalize_chain_name(chain)
        except HTTPException as e:
            raise e

        query = database_session.query(BlockedTransfer).order_by(
            BlockedTransfer.blocked_at.desc()
        )

        # Apply chain filter
        query = query.filter(BlockedTransfer.chain_id == canonical_chain)

        # Apply search filter
        if search:
            search_term = f"%{search.lower()}%"
            query = query.filter(
                (BlockedTransfer.sender_address.ilike(search_term)) |
                (BlockedTransfer.receiver_address.ilike(search_term))
            )

        # Apply min_risk filter
        if min_risk is not None:
            query = query.filter(BlockedTransfer.risk_score >= min_risk)

        # Get total count before limit
        total_count = query.count()
        blocked = query.limit(limit).all()

        total_blocked = database_session.query(BlockedTransfer).count()
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        blocked_today = database_session.query(BlockedTransfer).filter(
            BlockedTransfer.blocked_at >= today_start
        ).count()

        total_value_blocked = database_session.query(
            func.sum(BlockedTransfer.amount)
        ).scalar() or 0

        return {
            "blocked_transfers": [
                {
                    "id": str(b.id),
                    "sender_address": b.sender_address,
                    "receiver_address": b.receiver_address,
                    "amount_eth": _eth_from_wei(int(b.amount or 0)),
                    "risk_score": float(b.risk_score or 0),
                    "block_reason": b.block_reason,
                    "user_warning_count": b.user_warning_count,
                    "blocked_at": b.blocked_at.isoformat() if b.blocked_at else None
                }
                for b in blocked
            ],
            "statistics": {
                "total_blocked": total_blocked,
                "blocked_today": blocked_today,
                "total_value_blocked_eth": _eth_from_wei(int(total_value_blocked)),
                "total_matching": total_count
            },
            "count": len(blocked)
        }
    except Exception as blocked_error:
        logger.exception(f"Failed to fetch blocked transfers: {blocked_error}")
        return {
            "blocked_transfers": [],
            "statistics": {
                "total_blocked": 0,
                "blocked_today": 0,
                "total_value_blocked_eth": 0,
            },
            "count": 0,
            "error": "blocked_transfers_unavailable",
        }


@app.get("/_legacy_/cases", tags=["Cases"])
def get_cases(
    admin: User = Depends(require_admin),
    limit: int = 100,
    min_risk: float | None = None,
    search: str | None = None,
    status: str | None = None,
    database_session: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get transaction cases with optional filtering.

    Args:
        limit: Maximum number to return
        min_risk: Minimum risk score filter
        search: Search by transaction hash
        status: Filter by case status (PENDING, VERIFIED, FRAUD, IGNORED)
    """
    limit = max(1, min(int(limit or 100), 500))

    try:
        query = database_session.query(TransactionCase).order_by(
            TransactionCase.created_at.desc()
        )

        # Apply status filter
        if status and status != "all":
            query = query.filter(TransactionCase.state == status)

        # Apply search filter (by tx_hash)
        if search:
            search_term = f"%{search.lower()}%"
            query = query.filter(TransactionCase.tx_hash.ilike(search_term))

        # Get transaction data to filter by risk
        total_count = query.count()
        case_rows = query.limit(limit).all()

        # Join with transactions to get risk_score if needed
        cases_with_risk = []
        for case in case_rows:
            tx = database_session.query(Transaction).filter(
                Transaction.tx_hash == case.tx_hash
            ).first()

            risk_score = float(tx.normalized_risk_score * 100) if tx and tx.normalized_risk_score else 0.0

            # Apply min_risk filter post-query
            if min_risk is not None and risk_score < min_risk:
                continue

            cases_with_risk.append({
                "tx_hash": case.tx_hash,
                "from_address": tx.from_address if tx else None,
                "to_address": tx.to_address if tx else None,
                "value": str(tx.value) if tx else "0",
                "risk_score": risk_score,
                "status": case.state,
                "assigned_to": str(case.analyst_id) if case.analyst_id else None,
                "is_flagged": bool(tx.is_flagged) if tx else False,
                "flag_reason": tx.flag_reason if tx else None,
                "timestamp": tx.timestamp.isoformat() if tx and tx.timestamp else None,
                "updated_at": case.updated_at.isoformat() if case.updated_at else None,
            })

        return {
            "count": len(cases_with_risk),
            "cases": cases_with_risk,
            "statistics": {
                "total_cases": database_session.query(TransactionCase).count(),
                "matching_cases": total_count,
            }
        }
    except Exception as cases_error:
        logger.exception(f"Failed to fetch cases: {cases_error}")
        return {
            "count": 0,
            "cases": [],
            "statistics": {"total_cases": 0, "matching_cases": 0},
            "error": "cases_unavailable",
        }


@app.get("/statistics/dashboard", tags=["Admin - Dashboard"])
def get_dashboard_statistics(
    current_user: User = Depends(admin_or_analyst),
    chain: str = Query(default="ethereum"),
    database_session: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get comprehensive statistics for admin dashboard cards, filtered by chain.
    """
    # Normalize chain parameter
    try:
        canonical_chain = _normalize_chain_name(chain)
    except HTTPException as e:
        raise e

    # Query all wallets (no limit needed for accurate counts)
    all_wallets = database_session.query(Wallet).filter(
        Wallet.chain_id == canonical_chain
    ).all()
    all_alerts = database_session.query(Alert).filter(
        Alert.chain_id == canonical_chain
    ).all()

    ml_wallets = 0
    manip_wallets = 0
    scam_wallets = 0

    for wallet in all_wallets:
        category = (wallet.risk_category or "").lower()
        score = float(wallet.risk_score or 0)

        if category in {"scam", "fraud"} or score >= 85:
            scam_wallets += 1
        elif category in {"manipulation", "wash_trading", "market_manipulation"} or score >= 65:
            manip_wallets += 1
        elif category in {"money_laundering", "suspicious_activity", "layering", "structuring"} or score >= 45:
            ml_wallets += 1

    # Alert categorization
    ml_alerts = sum(1 for a in all_alerts 
        if any(k in (a.alert_type or "").upper() 
               for k in ["STRUCTUR", "MIXER", "LAYER", "RISK", "AML"]))
    manip_alerts = sum(1 for a in all_alerts 
        if any(k in (a.alert_type or "").upper() 
               for k in ["WASH", "PUMP", "DUMP", "CYCLE", "MANIP", "VELOCITY"]))
    scam_alerts = sum(1 for a in all_alerts 
        if any(k in (a.alert_type or "").upper() 
               for k in ["BLACKLIST", "SCAM", "HONEYPOT", "PHISH", "FRAUD"]))

    # General stats (filtered by chain)
    total_wallets = database_session.query(Wallet).filter(Wallet.chain_id == canonical_chain).count()
    total_alerts = database_session.query(Alert).filter(Alert.chain_id == canonical_chain).count()
    critical_alerts = database_session.query(Alert).filter(Alert.chain_id == canonical_chain, Alert.severity == 'CRITICAL').count()
    total_blocked = database_session.query(BlockedTransfer).filter(BlockedTransfer.chain_id == canonical_chain).count()

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    alerts_today = database_session.query(Alert).filter(Alert.detected_at >= today_start).count()

    return {
        "money_laundering": {
            "wallet_count": ml_wallets,
            "alert_count": ml_alerts,
            "icon": "Droplets",
            "color": "blue"
        },
        "manipulation": {
            "wallet_count": manip_wallets,
            "alert_count": manip_alerts,
            "icon": "LineChart",
            "color": "orange"
        },
        "scam": {
            "wallet_count": scam_wallets,
            "alert_count": scam_alerts,
            "icon": "Fish",
            "color": "red"
        },
        "overview": {
            "total_wallets": total_wallets,
            "total_alerts": total_alerts,
            "critical_alerts": critical_alerts,
            "alerts_today": alerts_today,
            "total_blocked": total_blocked
        }
    }


@app.get("/statistics/flow", tags=["Admin - History"])
def get_money_flow_statistics(
    current_user: User = Depends(admin_or_analyst),
    wallet_address: str = None,
    minutes: int = 5,
    chain: str = Query(default="ethereum"),
    database_session: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get money flow statistics (in/out) for charts, filtered by chain.
    Shows recent per-second/minute flows for specified wallet or network-wide.
    """
    from datetime import timedelta

    # Normalize chain parameter
    try:
        canonical_chain = _normalize_chain_name(chain)
    except HTTPException as e:
        raise e

    minutes = max(1, min(int(minutes or 5), 1440))
    normalized_wallet = (wallet_address or "").lower().strip() or None
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(minutes=minutes)

    try:
        # Attempt to fetch aggregated snapshots from the new reporting table
        snapshots = (
            database_session.query(MoneyFlowSnapshot)
            .filter(
                MoneyFlowSnapshot.chain_id == canonical_chain,
                MoneyFlowSnapshot.timestamp >= start_date,
                MoneyFlowSnapshot.wallet_address == (normalized_wallet if normalized_wallet else None)
            )
            .order_by(MoneyFlowSnapshot.timestamp.asc())
            .all()
        )

        results = []
        if snapshots:
            aggregated = {}
            for s in snapshots:
                # Truncate to second for smooth chart
                time_str = s.timestamp.strftime("%H:%M:%S")
                if time_str not in aggregated:
                    aggregated[time_str] = {"inflow": 0.0, "outflow": 0.0}
                aggregated[time_str]["inflow"] += float(s.inflow_eth or 0)
                aggregated[time_str]["outflow"] += float(s.outflow_eth or 0)
            
            for time_str, data in aggregated.items():
                results.append({
                    "date": time_str,  # Keep 'date' key for frontend compatibility
                    "inflow_eth": round(data["inflow"], 4),
                    "outflow_eth": round(data["outflow"], 4)
                })
        
        return {
            "flow_data": results,
            "period_minutes": minutes,
            "wallet_address": normalized_wallet
        }
    except Exception as flow_error:
        logger.exception(f"Failed to compute flow stats: {flow_error}")
        return {
            "flow_data": [],
            "period_minutes": minutes,
            "wallet_address": normalized_wallet,
            "error": "flow_stats_unavailable"
        }


# ==========================================
# USER WARNING SYSTEM (3 STRIKES)
# ==========================================

@app.post("/send-with-warning", tags=["Transaction"])
def send_eth_with_warning_system(
    payload: SendWithWarningRequest,
    database_session: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> Dict[str, Any]:
    """
    Enhanced send endpoint with 3-strike warning system.

    Flow:
    1. Check receiver risk
    2. If risky but not critical (50-80): Show warning, allow user to proceed
    3. If user proceeds despite warning: Record warning, increment count
    4. After 3 warnings: Auto-suspend sender account
    5. If critical (>80): Block immediately
    """
    sender = payload.sender.lower().strip()
    receiver = payload.receiver.lower().strip()
    amount = payload.amount
    force_proceed = payload.force_proceed  # User clicked "proceed anyway"

    if not sender or not receiver:
        raise HTTPException(status_code=400, detail="sender and receiver are required")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    # Get sender's current warning count
    sender_wallet = database_session.query(Wallet).filter(Wallet.address == sender).first()
    if not sender_wallet:
        sender_wallet = Wallet(address=sender)
        database_session.add(sender_wallet)
        database_session.commit()
        database_session.refresh(sender_wallet)

    # Check if sender is already suspended
    if sender_wallet.account_status == 'suspended':
        raise HTTPException(
            status_code=403,
            detail="Your account is suspended due to multiple risk warnings. Contact support."
        )

    # Get current warning count for this sender
    warning_count = database_session.query(UserWarning).filter(
        UserWarning.wallet_address == sender
    ).count()

    # Check receiver risk
    blacklist_record = database_session.query(Blacklist).filter(Blacklist.address == receiver).first()
    receiver_wallet = database_session.query(Wallet).filter(Wallet.address == receiver).first()

    receiver_risk = 0.0
    receiver_status = "unknown"

    if blacklist_record:
        receiver_risk = 100.0
        receiver_status = "blacklisted"
    elif receiver_wallet:
        receiver_risk = float(receiver_wallet.risk_score or 0)
        receiver_status = receiver_wallet.account_status
    else:
        # Analyze receiver if not in DB
        tx_history = fetch_wallet_history(receiver, max_count=100)
        ai_engine = MultiAgentDetectionEngine(database_session=database_session)
        risk_analysis = ai_engine.analyze_wallet(wallet_address=receiver, transactions=tx_history)
        receiver_risk = float(risk_analysis.get("total_score", 0.0))

    # Critical risk (>80 or blacklisted) - Block immediately
    if receiver_risk >= 80 or blacklist_record or receiver_status in ['frozen', 'suspended']:
        # Record blocked transfer
        blocked = BlockedTransfer(
            sender_address=sender,
            receiver_address=receiver,
            amount=_wei_from_eth(amount),
            risk_score=receiver_risk,
            block_reason="high_risk_receiver",
            user_warning_count=warning_count
        )
        database_session.add(blocked)
        database_session.commit()

        raise HTTPException(
            status_code=403,
            detail={
                "blocked": True,
                "reason": "Receiver is high-risk or blocked",
                "receiver_risk": receiver_risk,
                "receiver_status": receiver_status
            }
        )

    # Medium risk (50-80) - Show warning
    if receiver_risk >= 50 and not force_proceed:
        return {
            "status": "warning",
            "requires_confirmation": True,
            "receiver_risk": receiver_risk,
            "current_warnings": warning_count,
            "max_warnings": 3,
            "message": f"⚠️ This wallet has a risk score of {receiver_risk}%. Are you sure you want to proceed?",
            "warning_text": f"You have {3 - warning_count} warnings remaining before account suspension."
        }

    # User chose to proceed despite warning
    if force_proceed and receiver_risk >= 50:
        # Record warning
        new_warning = UserWarning(
            wallet_address=sender,
            target_address=receiver,
            warning_type="RISK_IGNORED",
            risk_score=receiver_risk,
            user_action="ignored",
            warning_number=warning_count + 1
        )
        database_session.add(new_warning)
        warning_count += 1

        # Check if 3 strikes reached
        if warning_count >= 3:
            sender_wallet.account_status = 'suspended'
            sender_wallet.flagged_at = datetime.now(timezone.utc)
            sender_wallet.flagged_by = 'SYSTEM_AUTO_SUSPEND'
            sender_wallet.notes = f"{sender_wallet.notes or ''}\n[{datetime.now(timezone.utc).isoformat()}] Auto-suspended after 3 risk warnings."

            # Create alert for admin
            suspend_alert = Alert(
                wallet_address=sender,
                alert_type="USER_SUSPENDED",
                severity="HIGH",
                message=f"User account auto-suspended after ignoring 3 risk warnings. Last attempted transfer to {receiver}.",
                risk_score=receiver_risk,
                alert_metadata={
                    "warning_count": warning_count,
                    "last_target": receiver,
                    "last_risk": receiver_risk
                }
            )
            database_session.add(suspend_alert)
            database_session.commit()

            raise HTTPException(
                status_code=403,
                detail={
                    "suspended": True,
                    "reason": "Account suspended after 3 ignored risk warnings",
                    "warning_count": warning_count
                }
            )

        database_session.commit()

    # Proceed with transaction (low risk or user accepted warning)
    amount_wei = _wei_from_eth(amount)

    # Check balance
    sender_received_wei = database_session.query(
        func.coalesce(func.sum(Transaction.value), 0)
    ).filter(Transaction.to_address == sender).scalar()

    sender_sent_wei = database_session.query(
        func.coalesce(func.sum(Transaction.value), 0)
    ).filter(Transaction.from_address == sender).scalar()

    sender_balance_wei = int(sender_received_wei or 0) - int(sender_sent_wei or 0)

    if sender_balance_wei < amount_wei:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    # Create transaction
    import uuid as uuid_module
    tx_hash = f"sim_{uuid_module.uuid4().hex}"
    tx = Transaction(
        tx_hash=tx_hash,
        from_address=sender,
        to_address=receiver,
        value=amount_wei,
        block_number=0,
        timestamp=datetime.now(timezone.utc),
        gas_price=0,
        gas_used=0,
        input_data="0x",
        status=1
    )
    database_session.add(tx)

    # Update wallets
    sender_wallet.total_value_sent = int(sender_wallet.total_value_sent or 0) + amount_wei
    sender_wallet.total_transactions = int(sender_wallet.total_transactions or 0) + 1
    sender_wallet.last_activity_at = datetime.now(timezone.utc)

    if not receiver_wallet:
        receiver_wallet = Wallet(address=receiver)
        database_session.add(receiver_wallet)

    receiver_wallet.total_value_received = int(receiver_wallet.total_value_received or 0) + amount_wei
    receiver_wallet.total_transactions = int(receiver_wallet.total_transactions or 0) + 1
    receiver_wallet.last_activity_at = datetime.now(timezone.utc)

    database_session.commit()

    # Calculate new balance
    new_balance_wei = sender_balance_wei - amount_wei

    return {
        "status": "success",
        "tx_hash": tx_hash,
        "from": sender,
        "to": receiver,
        "amount_eth": amount,
        "receiver_risk_score": receiver_risk,
        "warning_count": warning_count,
        "sender_balance_eth": _eth_from_wei(new_balance_wei),
        "message": "Transaction completed successfully" + (f" (Warning #{warning_count} recorded)" if force_proceed and receiver_risk >= 50 else "")
    }


@app.post("/transfers/batch", tags=["Transaction"])
def batch_transfer(
    payload: BatchTransferRequest,
    current_user: Optional[User] = Depends(optional_auth),
    database_session: Session = Depends(get_db),
) -> Dict[str, Any]:
    transfers = payload.transfers
    if not transfers:
        raise HTTPException(status_code=400, detail="No transfers provided")
    results = []
    for tx in transfers:
        from_addr = tx.from_address.lower().strip()
        to_addr = tx.to_address.lower().strip()
        amount = tx.amount_eth
        if not from_addr or not to_addr or amount <= 0:
            results.append({"from": from_addr, "to": to_addr, "amount_eth": amount, "status": "invalid", "error": "Missing or invalid fields"})
            continue
        try:
            result = _execute_single_transfer(database_session, from_addr, to_addr, amount)
            results.append({**result, "status": "success"})
        except HTTPException as e:
            results.append({"from": from_addr, "to": to_addr, "amount_eth": amount, "status": "blocked", "error": e.detail})
        except Exception as e:
            results.append({"from": from_addr, "to": to_addr, "amount_eth": amount, "status": "error", "error": str(e)})
    return {"total": len(transfers), "success_count": sum(1 for r in results if r["status"] == "success"), "results": results}


    # Fetch rates from DB instead of hardcoded


    # Fetch rate from DB for the given pair (default chain: ethereum)


@app.get("/user/{wallet_address}/history", tags=["User"])
def get_user_history(
    wallet_address: str,
    current_user: Optional[User] = Depends(optional_auth),
    database_session: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get user's transaction history including blocked transfers, successful transactions, and warnings.
    """
    normalized_address = _validate_ethereum_address(wallet_address)

    # Get blocked transfers where user was the sender
    blocked = database_session.query(BlockedTransfer).filter(
        BlockedTransfer.sender_address == normalized_address
    ).order_by(BlockedTransfer.blocked_at.desc()).limit(50).all()

    # Get successful transactions (both sent and received)
    transactions = database_session.query(Transaction).filter(
        (Transaction.from_address == normalized_address) | (Transaction.to_address == normalized_address)
    ).order_by(Transaction.timestamp.desc().nullslast()).limit(50).all()

    # Get warnings for this wallet
    warnings = database_session.query(UserWarning).filter(
        UserWarning.wallet_address == normalized_address
    ).order_by(UserWarning.created_at.desc()).limit(20).all()

    return {
        "wallet_address": normalized_address,
        "blocked_transfers": [
            {
                "id": str(b.id),
                "sender_address": b.sender_address,
                "receiver_address": b.receiver_address,
                "amount_eth": _eth_from_wei(int(b.amount or 0)),
                "risk_score": float(b.risk_score or 0),
                "block_reason": b.block_reason,
                "user_warning_count": b.user_warning_count,
                "blocked_at": b.blocked_at.isoformat() if b.blocked_at else None
            }
            for b in blocked
        ],
        "successful_transactions": [
            {
                "id": str(tx.id),
                "tx_hash": tx.tx_hash,
                "from_address": tx.from_address,
                "to_address": tx.to_address,
                "value_eth": _eth_from_wei(int(tx.value or 0)),
                "direction": "sent" if tx.from_address == normalized_address else "received",
                "timestamp": tx.timestamp.isoformat() if tx.timestamp else None,
                "status": int(tx.status or 1),
                "is_flagged": bool(tx.is_flagged),
                "flag_reason": tx.flag_reason
            }
            for tx in transactions
        ],
        "warnings": [
            {
                "id": str(w.id),
                "wallet_address": w.wallet_address,
                "target_address": w.target_address,
                "warning_type": w.warning_type,
                "risk_score": float(w.risk_score or 0),
                "user_action": w.user_action,
                "warning_number": w.warning_number,
                "created_at": w.created_at.isoformat() if w.created_at else None
            }
            for w in warnings
        ],
        "summary": {
            "total_blocked": len(blocked),
            "total_transactions": len(transactions),
            "total_warnings": len(warnings),
            "warning_count": len([w for w in warnings if w.user_action == 'ignored'])
        }
    }


# ============================================================================
# ML / AI Pipeline API
# ============================================================================

class PromoteModelRequest(BaseModel):
    model_name: str
    version: str
    artifact_uri: str = ""
    framework: str = "pkl"

@app.post("/admin/models/promote", tags=["Admin - AI/ML"])
def promote_model(
    payload: PromoteModelRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Promote a model version to active (deactivates all other versions)."""
    existing = db.query(ModelRegistry).filter(
        ModelRegistry.model_name == payload.model_name,
        ModelRegistry.version == payload.version
    ).first()
    if existing:
        existing.is_active = True
        existing.promoted_at = datetime.now(timezone.utc)
        existing.promoted_by = admin.id
    else:
        artifact_uri = payload.artifact_uri or f"/models/{payload.model_name}/{payload.version}/"
        entry = ModelRegistry(
            model_name=payload.model_name, version=payload.version,
            artifact_uri=artifact_uri, framework=payload.framework,
            is_active=True, promoted_by=admin.id, promoted_at=datetime.now(timezone.utc)
        )
        db.add(entry)
    db.query(ModelRegistry).filter(
        ModelRegistry.model_name == payload.model_name,
        ModelRegistry.version != payload.version
    ).update({"is_active": False})
    db.commit()
    return {"success": True, "model_name": payload.model_name, "version": payload.version}

@app.get("/admin/models", tags=["Admin - AI/ML"])
def list_models(
    admin: User = Depends(require_admin),
    active_only: bool = Query(False, description="Only return active models"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """List all registered models."""
    q = db.query(ModelRegistry).order_by(ModelRegistry.model_name, ModelRegistry.created_at.desc())
    if active_only:
        q = q.filter(ModelRegistry.is_active == True)
    items = []
    for m in q.all():
        items.append({
            "id": str(m.id), "model_name": m.model_name, "version": m.version,
            "framework": m.framework, "is_active": m.is_active,
            "artifact_uri": m.artifact_uri,
            "promoted_at": m.promoted_at.isoformat() if m.promoted_at else None,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        })
    return {"count": len(items), "items": items}

@app.get("/admin/models/active", tags=["Admin - AI/ML"])
def get_active_model(
    admin: User = Depends(require_admin),
    model_name: str = Query("risk_predictor"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get the currently active model for a given name."""
    model = db.query(ModelRegistry).filter(
        ModelRegistry.model_name == model_name, ModelRegistry.is_active == True
    ).first()
    if not model:
        return {"found": False, "model_name": model_name}
    return {
        "found": True, "id": str(model.id), "model_name": model.model_name,
        "version": model.version, "framework": model.framework,
        "artifact_uri": model.artifact_uri,
        "promoted_at": model.promoted_at.isoformat() if model.promoted_at else None,
    }

@app.get("/admin/features", tags=["Admin - AI/ML"])
def list_features(
    admin: User = Depends(require_admin),
    enabled_only: bool = Query(True),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """List feature store configs."""
    q = db.query(FeatureStoreConfig).order_by(FeatureStoreConfig.feature_key)
    if enabled_only:
        q = q.filter(FeatureStoreConfig.enabled == True)
    items = []
    for f in q.all():
        items.append({
            "id": str(f.id), "feature_key": f.feature_key,
            "enabled": f.enabled, "expression": f.expression,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        })
    return {"count": len(items), "items": items}

class RetrainTriggerRequest(BaseModel):
    model_name: str = "risk_predictor"
    feedback_threshold: int = 50

@app.post("/admin/retrain", tags=["Admin - AI/ML"])
def trigger_retrain(
    payload: RetrainTriggerRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Trigger model retraining using collected feedback data."""
    unlabeled = db.query(FeedbackLabel).filter(FeedbackLabel.admin_label == "uncertain").count()
    labeled = db.query(FeedbackLabel).filter(FeedbackLabel.admin_label.in_(["fraud", "safe"])).count()
    total = unlabeled + labeled
    if total < payload.feedback_threshold:
        return {
            "triggered": False,
            "reason": f"Insufficient feedback: {total} samples (need {payload.feedback_threshold})",
            "unlabeled": unlabeled, "labeled": labeled
        }
    try:
        from retrain_from_feedback import retrain as run_retrain
        run_retrain()
    except Exception as e:
        logger.exception(f"Retrain failed: {e}")
        return {
            "triggered": False, "error": str(e),
            "unlabeled": unlabeled, "labeled": labeled
        }
    return {
        "triggered": True, "model_name": payload.model_name,
        "unlabeled": unlabeled, "labeled": labeled, "total": total
    }

@app.get("/admin/models/metrics", tags=["Admin - AI/ML"])
def get_model_metrics(
    admin: User = Depends(require_admin),
    model_name: str = Query("risk_predictor"),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get pipeline metrics for a given model."""
    metrics = db.query(PipelineMetric).order_by(
        PipelineMetric.inserted_at.desc()
    ).limit(limit).all()
    items = []
    for m in reversed(metrics):
        items.append({
            "id": str(m.id), "chain": m.chain,
            "block_number": m.block_number, "throughput_tps": m.throughput_tps,
            "ingestion_latency_ms": m.ingestion_latency_ms,
            "decode_latency_ms": m.decode_latency_ms,
            "inserted_at": m.inserted_at.isoformat() if m.inserted_at else None,
        })
    return {"count": len(items), "items": items}


# ============================================================================
class OrganizationCreate(BaseModel):
    name: str
    slug: str
    contact_email: str
    is_active: bool = True

@app.get("/ops/system/organizations", tags=["System Admin"])
def get_organizations(admin: User = Depends(require_admin), database_session: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get all organizations from database without hardcoded fallbacks."""
    try:
        orgs = database_session.query(Organization).order_by(Organization.name).all()
        items = []
        for org in orgs:
            user_count = database_session.query(User).filter(User.organization_id == org.id).count()
            items.append({
                "id": str(org.id),
                "name": org.name,
                "slug": org.slug,
                "status": "Active" if org.is_active else "Suspended",
                "users": user_count,
                "api_calls": "0"
            })
        return {"count": len(items), "items": items}
    except Exception as e:
        logger.exception(f"Failed to fetch organizations: {e}")
        return {"count": 0, "items": [], "error": str(e)}

@app.post("/ops/system/organizations", tags=["System Admin"])
def create_organization(payload: OrganizationCreate, admin: User = Depends(require_admin), database_session: Session = Depends(get_db)) -> Dict[str, Any]:
    """Create a new organization."""
    try:
        existing = database_session.query(Organization).filter(
            (Organization.name == payload.name) | (Organization.slug == payload.slug)
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Organization with this name or slug already exists.")
            
        org = Organization(
            name=payload.name,
            slug=payload.slug,
            contact_email=payload.contact_email,
            is_active=payload.is_active,
            api_key=f"sk_live_{payload.slug}_{uuid.uuid4().hex[:6]}"
        )
        database_session.add(org)
        database_session.commit()
        database_session.refresh(org)
        return {
            "success": True,
            "organization": {
                "id": str(org.id),
                "name": org.name,
                "slug": org.slug,
                "status": "Active" if org.is_active else "Suspended",
                "users": 0,
                "api_calls": "0"
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to create organization: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ops/system/api-keys", tags=["System Admin"])
def get_api_keys(admin: User = Depends(require_admin), database_session: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get active API keys from organizations."""
    try:
        orgs = database_session.query(Organization).filter(Organization.api_key.is_not(None)).all()
        items = [
            {
                "id": str(org.id),
                "name": f"{org.name} Gateway",
                "key": org.api_key,
                "created": org.created_at.strftime("%Y-%m-%d") if org.created_at else datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "usage": "0"
            }
            for org in orgs
        ]
        return {"count": len(items), "items": items}
    except Exception as e:
        logger.exception(f"Failed to fetch API keys: {e}")
        return {"count": 0, "items": [], "error": str(e)}

@app.post("/ops/system/api-keys", tags=["System Admin"])
def generate_api_key(org_id: str = Query(...), admin: User = Depends(require_admin), database_session: Session = Depends(get_db)) -> Dict[str, Any]:
    """Generate or regenerate API key for an organization."""
    try:
        org = database_session.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        org.api_key = f"sk_live_{org.slug}_{uuid.uuid4().hex[:6]}"
        database_session.commit()
        return {
            "success": True,
            "key": {
                "id": str(org.id),
                "name": f"{org.name} Gateway",
                "key": org.api_key,
                "created": datetime.now().strftime("%Y-%m-%d"),
                "usage": "Low"
            }
        }
    except Exception as e:
        logger.exception(f"Failed to generate API key: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/ops/system/api-keys/{org_id}", tags=["System Admin"])
def revoke_api_key(org_id: str, admin: User = Depends(require_admin), database_session: Session = Depends(get_db)) -> Dict[str, Any]:
    """Revoke (clear) API key for an organization."""
    try:
        org = database_session.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        org.api_key = None
        database_session.commit()
        return {"success": True}
    except Exception as e:
        logger.exception(f"Failed to revoke API key: {e}")
        raise HTTPException(status_code=500, detail=str(e))

