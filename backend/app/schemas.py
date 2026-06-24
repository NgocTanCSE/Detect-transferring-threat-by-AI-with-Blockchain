"""Pydantic schemas for request/response validation used by FastAPI endpoints.
All schemas inherit from BaseModel and enforce type checking, optional defaults,
and field constraints where appropriate.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
import re

from pydantic import BaseModel, Field, EmailStr, field_validator

# ---------------------------------------------------------------------------
# Auth / User
# ---------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(..., min_length=8)
    wallet_address: Optional[str] = None
    organization_name: Optional[str] = None
    organization_id: Optional[str] = None

    @field_validator("wallet_address")
    @classmethod
    def normalize_wallet(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return v
        normalized = v.lower().strip()
        if not re.match(r"^0x[a-f0-9]{40}$", normalized):
            raise ValueError("wallet_address must be 0x + 40 hexadecimal characters")
        return normalized

class RegisterResponse(BaseModel):
    id: str
    username: str
    email: str
    wallet_address: Optional[str] = None
    created_at: datetime

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: Optional[int] = None
    user: Dict[str, Any]

# ---------------------------------------------------------------------------
# Assistant Chat
# ---------------------------------------------------------------------------
class AssistantChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    role: str = Field("operator", max_length=50)
    wallet_address: Optional[str] = Field(None, max_length=255)
    screen_scope: str = Field("dashboard", max_length=50)
    conversation_history: List[Dict[str, Any]] = Field(default_factory=list)
    context: Optional[Dict[str, Any]] = None

    @field_validator("message")
    @classmethod
    def message_not_blank(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("message must not be blank")
        return stripped

    @field_validator("role")
    @classmethod
    def normalize_role(cls, v: str) -> str:
        return v.strip() or "operator"


# ---------------------------------------------------------------------------
# Wallet / Transaction Overview (used by the assistant/dashboard)
# ---------------------------------------------------------------------------
class WalletBrief(BaseModel):
    address: str
    label: Optional[str] = None
    risk_score: float = 0.0
    account_status: str = "active"
    total_transactions: int = 0
    total_value_received: float = 0.0
    total_value_sent: float = 0.0

class OverviewMetrics(BaseModel):
    total_wallets: int = 0
    total_alerts: int = 0
    critical_alerts: int = 0
    alerts_today: int = 0
    total_blocked: int = 0

class DashboardContext(BaseModel):
    role: str
    screen_scope: str = "dashboard"
    overview: OverviewMetrics
    flow_7d: List[Dict[str, Any]] = []
    top_risky_wallets: List[WalletBrief] = []
    wallet_focus: Optional[WalletBrief] = None

    @field_validator("overview", mode="before")
    @classmethod
    def ensure_overview(cls, v):
        if isinstance(v, dict):
            return OverviewMetrics(**v)
        return v

# ---------------------------------------------------------------------------
# Generic API response wrapper (mirrors utils.api_response)
# ---------------------------------------------------------------------------
class ApiSuccess(BaseModel):
    success: bool = True
    data: Any
    message: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None
    legacy: Optional[Any] = None

class ApiError(BaseModel):
    success: bool = False
    error: str
    code: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    legacy: Optional[Any] = None

