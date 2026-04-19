"""
Admin Diagnostics Module
Provides logging, audit trails, and system health checks for admin dashboard.
"""

import logging
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from enum import Enum
from sqlalchemy import text

logger = logging.getLogger(__name__)

class DiagnosticLogType(str, Enum):
    """Types of diagnostic events."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    API_CALL = "api_call"
    API_ERROR = "api_error"
    SEED_DATA = "seed_data"
    DATABASE = "database"
    AI_SERVICE = "ai_service"


class DiagnosticLog:
    """In-memory diagnostic log storage (ring buffer)."""

    MAX_LOGS = 1000  # Keep last 1000 entries

    def __init__(self):
        self.logs: List[Dict[str, Any]] = []
        self.endpoint_stats: Dict[str, Dict[str, Any]] = {}

    def add_log(
        self,
        log_type: DiagnosticLogType,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        status_code: Optional[int] = None,
        endpoint: Optional[str] = None,
    ):
        """Add a diagnostic log entry."""
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "type": log_type.value,
            "message": message,
            "details": details or {},
            "status_code": status_code,
            "endpoint": endpoint,
        }

        self.logs.append(entry)
        if len(self.logs) > self.MAX_LOGS:
            self.logs = self.logs[-self.MAX_LOGS:]

        # Track endpoint statistics
        if endpoint:
            if endpoint not in self.endpoint_stats:
                self.endpoint_stats[endpoint] = {
                    "total_calls": 0,
                    "success_count": 0,
                    "error_count": 0,
                    "last_status_code": None,
                    "last_error": None,
                    "last_called": None,
                }

            stats = self.endpoint_stats[endpoint]
            stats["total_calls"] += 1
            stats["last_called"] = entry["timestamp"]
            stats["last_status_code"] = status_code

            if log_type == DiagnosticLogType.API_ERROR or (status_code and status_code >= 400):
                stats["error_count"] += 1
                stats["last_error"] = message
            else:
                stats["success_count"] += 1

    def get_recent_logs(self, limit: int = 50, log_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get recent logs, optionally filtered by type."""
        filtered = self.logs
        if log_type:
            filtered = [log for log in filtered if log["type"] == log_type]
        return filtered[-limit:]

    def get_endpoint_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get statistics for all endpoints."""
        return self.endpoint_stats

    def clear(self):
        """Clear all logs."""
        self.logs.clear()
        self.endpoint_stats.clear()


# Global diagnostic logger instance
diagnostic_logger = DiagnosticLog()


def log_diagnostic(
    log_type: DiagnosticLogType,
    message: str,
    details: Optional[Dict[str, Any]] = None,
    status_code: Optional[int] = None,
    endpoint: Optional[str] = None,
):
    """Log a diagnostic event."""
    diagnostic_logger.add_log(log_type, message, details, status_code, endpoint)

    # Also log to Python logger
    log_level = {
        DiagnosticLogType.ERROR: logging.ERROR,
        DiagnosticLogType.WARNING: logging.WARNING,
        DiagnosticLogType.API_ERROR: logging.ERROR,
    }.get(log_type, logging.INFO)

    logger.log(log_level, f"[{log_type.value.upper()}] {message}")


def get_seed_data_counts(database_session) -> Dict[str, int]:
    """Get counts of all seeded data types."""
    from app.models.models import (
        User, Wallet, Transaction, Alert, BlockedTransfer, TransactionCase,
        PolicyRule, NotificationEvent, FeatureStoreConfig, ModelRegistry,
        NodeEndpoint, PipelineMetric, AuditLog
    )

    counts = {
        "users": database_session.query(User).count(),
        "wallets": database_session.query(Wallet).count(),
        "transactions": database_session.query(Transaction).count(),
        "alerts": database_session.query(Alert).count(),
        "blocked_transfers": database_session.query(BlockedTransfer).count(),
        "transaction_cases": database_session.query(TransactionCase).count(),
        "policy_rules": database_session.query(PolicyRule).count(),
        "notification_events": database_session.query(NotificationEvent).count(),
        "feature_store_configs": database_session.query(FeatureStoreConfig).count(),
        "model_registry": database_session.query(ModelRegistry).count(),
        "node_endpoints": database_session.query(NodeEndpoint).count(),
        "pipeline_metrics": database_session.query(PipelineMetric).count(),
        "audit_logs": database_session.query(AuditLog).count(),
    }
    return counts


def get_database_health(database_session) -> Dict[str, Any]:
    """Check database health and schema."""
    try:
        result = database_session.execute(text("SELECT 1"))
        return {
            "status": "connected",
            "error": None,
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
        }


def get_system_status(database_session) -> Dict[str, Any]:
    """Get overall system status for admin diagnostics."""
    from app.core.config import HF_API_TOKEN, DATABASE_URL

    seed_counts = get_seed_data_counts(database_session)
    db_health = get_database_health(database_session)

    hf_configured = bool(HF_API_TOKEN)

    return {
        "timestamp": datetime.utcnow().isoformat(),
        "database": {
            "url": DATABASE_URL.split("@")[0] if "@" in DATABASE_URL else DATABASE_URL[:50],  # Hide credentials
            "health": db_health,
        },
        "ai_service": {
            "hf_token_configured": hf_configured,
        },
        "seed_data": seed_counts,
        "endpoints": diagnostic_logger.get_endpoint_stats(),
        "recent_errors": [
            log for log in diagnostic_logger.get_recent_logs(limit=20)
            if log["type"] in ["error", "api_error"]
        ],
    }
