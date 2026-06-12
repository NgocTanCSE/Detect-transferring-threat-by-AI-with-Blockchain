"""Pydantic schemas for request/response validation used by FastAPI endpoints.
All schemas inherit from BaseModel and enforce type checking, optional defaults,
and field constraints where appropriate.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field, EmailStr, validator

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

    @validator("wallet_address")
    def normalize_wallet(cls, v: Optional[str]) -> Optional[str]:
        return v.lower().strip() if v else v

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

# ---------------------------------------------------------------------------
# Helper validators (example of edge‑case handling)
# ---------------------------------------------------------------------------
@validator("overview", pre=True, always=True)
def ensure_overview(cls, v):
    # Accept dict or already‑parsed OverviewMetrics
    if isinstance(v, dict):
        return OverviewMetrics(**v)
    return v

