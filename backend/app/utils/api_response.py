"""Standard API response envelope helpers."""

from datetime import datetime, timezone
from typing import Any, Dict, Optional


def api_success(
    data: Any = None,
    *,
    message: str = "OK",
    meta: Optional[Dict[str, Any]] = None,
    legacy: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "status": "success",
        "message": message,
        "data": data,
        "meta": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **(meta or {}),
        },
    }
    if legacy:
        payload.update(legacy)
    return payload


def api_error(
    *,
    message: str,
    code: str = "INTERNAL_ERROR",
    details: Optional[Dict[str, Any]] = None,
    legacy: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "status": "error",
        "message": message,
        "error": {
            "code": code,
            "details": details or {},
        },
        "meta": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    }
    if legacy:
        payload.update(legacy)
    return payload
