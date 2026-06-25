"""JWT Authentication module for blockchain risk assessment API."""

import logging
import os
import re
import secrets
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Optional, Dict, List, Any
import uuid

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import get_db
from app.models.models import User, Wallet, Transaction, Alert, BlockedTransfer, UserProfile


# --- Pydantic Request Schemas ---

class UpdateProfileDetailsRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class UpdateProfilePreferencesRequest(BaseModel):
    email: Optional[bool] = None
    push: Optional[bool] = None
    sms: Optional[bool] = None


# Configuration — lazy JWT secret: checked at first use, not at import time
def _get_jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET_KEY", "")
    if not secret:
        raise RuntimeError("JWT_SECRET_KEY environment variable is not set. Authentication cannot function without a secret key.")
    return secret

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
AUTH_DISABLED = os.getenv("AUTH_DISABLED", "false").lower() == "true"

# Anti-spam configuration for registration
REGISTRATION_RATE_LIMIT = int(os.getenv("REGISTRATION_RATE_LIMIT", "3"))  # Max registrations per IP per hour
REGISTRATION_WINDOW_SECONDS = int(os.getenv("REGISTRATION_WINDOW_SECONDS", "3600"))  # 1 hour
MIN_REGISTRATION_INTERVAL = int(os.getenv("MIN_REGISTRATION_INTERVAL", "30"))  # Min seconds between registrations

# Account lockout
MAX_LOGIN_ATTEMPTS = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
LOGIN_LOCKOUT_MINUTES = int(os.getenv("LOGIN_LOCKOUT_MINUTES", "15"))
_login_attempts: Dict[str, List[float]] = defaultdict(list)
_login_attempts_lock = Lock()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _ensure_auth_enabled() -> None:
    if AUTH_DISABLED:
        return


def _safe_parse_user_id(user_id: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(user_id))
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def _link_registered_user_wallet(db: Session, user: User) -> None:
    """Link newly created regular user to existing wallet-centric data in the system."""
    if not user.wallet_address:
        return

    wallet_address = user.wallet_address.lower()
    wallet = db.query(Wallet).filter(Wallet.address == wallet_address).first()

    tx_total = (
        db.query(func.count(Transaction.id))
        .filter(or_(Transaction.from_address == wallet_address, Transaction.to_address == wallet_address))
        .scalar()
        or 0
    )
    tx_sent_value = (
        db.query(func.coalesce(func.sum(Transaction.value), 0))
        .filter(Transaction.from_address == wallet_address)
        .scalar()
        or 0
    )
    tx_recv_value = (
        db.query(func.coalesce(func.sum(Transaction.value), 0))
        .filter(Transaction.to_address == wallet_address)
        .scalar()
        or 0
    )
    tx_last_activity = (
        db.query(func.max(Transaction.timestamp))
        .filter(or_(Transaction.from_address == wallet_address, Transaction.to_address == wallet_address))
        .scalar()
    )

    alert_count = (
        db.query(func.count(Alert.id))
        .filter(Alert.wallet_address == wallet_address)
        .scalar()
        or 0
    )
    max_warning_count = (
        db.query(func.max(BlockedTransfer.user_warning_count))
        .filter(BlockedTransfer.sender_address == wallet_address)
        .scalar()
        or 0
    )

    if not wallet:
        wallet = Wallet(
            address=wallet_address,
            label=f"{user.username} linked wallet",
            entity_type="Individual",
            account_status="active",
            risk_score=0.0,
            total_transactions=int(tx_total),
            total_value_sent=tx_sent_value,
            total_value_received=tx_recv_value,
            first_seen_at=datetime.now(timezone.utc),
            last_activity_at=tx_last_activity,
            notes="Auto-linked during user registration",
        )
        db.add(wallet)
    else:
        wallet.total_transactions = max(int(wallet.total_transactions or 0), int(tx_total))
        wallet.total_value_sent = tx_sent_value
        wallet.total_value_received = tx_recv_value
        if tx_last_activity:
            wallet.last_activity_at = tx_last_activity
        if not wallet.label:
            wallet.label = f"{user.username} linked wallet"
        if alert_count and not wallet.notes:
            wallet.notes = "Linked to historical alerts before account creation"

    user.warning_count = max(int(user.warning_count or 0), int(max_warning_count))


# ==========================================
# REGISTRATION RATE LIMITER
# ==========================================

class RegistrationRateLimiter:
    """IP-based rate limiter for registration to prevent spam accounts."""

    def __init__(self):
        self._registrations: Dict[str, List[float]] = defaultdict(list)
        self._lock = Lock()
        self._last_cleanup = time.time()

    def _cleanup(self) -> None:
        """Remove expired entries."""
        now = time.time()
        if now - self._last_cleanup < 300:  # Cleanup every 5 minutes
            return

        cutoff = now - REGISTRATION_WINDOW_SECONDS - 60
        for ip in list(self._registrations.keys()):
            self._registrations[ip] = [t for t in self._registrations[ip] if t > cutoff]
            if not self._registrations[ip]:
                del self._registrations[ip]
        self._last_cleanup = now

    def check_rate_limit(self, ip_address: str) -> tuple[bool, Optional[str], Optional[int]]:
        """
        Check if registration is allowed for this IP.

        Returns:
            Tuple of (allowed, error_message, retry_after_seconds)
        """
        with self._lock:
            self._cleanup()
            now = time.time()

            # Get recent registrations for this IP
            window_start = now - REGISTRATION_WINDOW_SECONDS
            recent = [t for t in self._registrations[ip_address] if t > window_start]

            # Check minimum interval
            if recent:
                last_registration = max(recent)
                elapsed = now - last_registration
                if elapsed < MIN_REGISTRATION_INTERVAL:
                    wait_time = int(MIN_REGISTRATION_INTERVAL - elapsed) + 1
                    return (False, f"Please wait {wait_time}s before creating another account", wait_time)

            # Check hourly limit
            if len(recent) >= REGISTRATION_RATE_LIMIT:
                oldest = min(recent)
                wait_time = int(oldest + REGISTRATION_WINDOW_SECONDS - now) + 1
                return (
                    False,
                    f"Too many accounts created. Limit: {REGISTRATION_RATE_LIMIT} per hour. Try again in {wait_time // 60} minutes.",
                    wait_time
                )

            return (True, None, None)

    def record_registration(self, ip_address: str) -> None:
        """Record a successful registration."""
        with self._lock:
            self._registrations[ip_address].append(time.time())


# Global registration rate limiter
registration_limiter = RegistrationRateLimiter()


# ==========================================
# SPAM ACCOUNT DETECTION RULES
# ==========================================

import re

# Known disposable/temporary email domains (commonly used by bots)
DISPOSABLE_EMAIL_DOMAINS = {
    'tempmail.com', 'guerrillamail.com', 'mailinator.com', 'yopmail.com',
    'throwaway.email', '10minutemail.com', 'temp-mail.org', 'fakeinbox.com',
    'trashmail.com', 'getnada.com', 'maildrop.cc', 'mohmal.com',
    'dispostable.com', 'mailnesia.com', 'sharklasers.com', 'guerrillamail.info',
    'tempail.com', 'emailondeck.com', 'mailcatch.com', 'mintemail.com',
}

# Patterns that indicate bot-generated usernames
BOT_USERNAME_PATTERNS = [
    r'^[a-z]{2,4}\d{6,}$',           # abc123456 pattern
    r'^user\d{4,}$',                  # user12345 pattern
    r'^test\d+$',                     # test123 pattern
    r'^[a-z0-9]{20,}$',              # Long random alphanumeric
    r'^[a-z]+_\d{8,}$',              # word_12345678 pattern
    r'spam|bot|fake|test\d+|temp',   # Explicit spam keywords
]


class SpamAccountDetector:
    """Detect suspicious account registration patterns."""

    @staticmethod
    def check_username(username: str) -> tuple[bool, Optional[str]]:
        """
        Check if username looks like a bot-generated name.

        Returns:
            Tuple of (is_suspicious, reason)
        """
        username_lower = username.lower()

        # Check against bot patterns
        for pattern in BOT_USERNAME_PATTERNS:
            if re.match(pattern, username_lower):
                return (True, f"Username matches suspicious pattern")

        # Check for too many consecutive numbers
        if re.search(r'\d{6,}', username):
            return (True, "Username contains too many consecutive numbers")

        # Check for keyboard mashing patterns (qwerty, asdf, etc.)
        keyboard_patterns = ['qwerty', 'asdfgh', 'zxcvbn', 'qazwsx', '123456', 'abcdef']
        for kp in keyboard_patterns:
            if kp in username_lower:
                return (True, "Username contains keyboard pattern")

        return (False, None)

    @staticmethod
    def check_email(email: str) -> tuple[bool, Optional[str]]:
        """
        Check if email uses a disposable domain or suspicious pattern.

        Returns:
            Tuple of (is_suspicious, reason)
        """
        email_lower = email.lower()
        domain = email_lower.split('@')[-1] if '@' in email else ''

        # Check disposable email domains
        if domain in DISPOSABLE_EMAIL_DOMAINS:
            return (True, f"Disposable email domain not allowed: {domain}")

        # Check for subdomain abuse (e.g., user@sub.domain.mailinator.com)
        for disposable in DISPOSABLE_EMAIL_DOMAINS:
            if disposable in domain:
                return (True, f"Email domain contains known disposable service")

        # Check for plus-addressing abuse (multiple + signs)
        local_part = email_lower.split('@')[0] if '@' in email else ''
        if local_part.count('+') > 1:
            return (True, "Email contains excessive plus-addressing")

        # Check for dot-stuffing (many dots in local part)
        if local_part.count('.') > 4:
            return (True, "Email contains excessive dots")

        return (False, None)

    @staticmethod
    def check_wallet_pattern(wallet_address: Optional[str]) -> tuple[bool, Optional[str]]:
        """
        Check if wallet address looks auto-generated or suspicious.

        Returns:
            Tuple of (is_suspicious, reason)
        """
        if not wallet_address:
            return (False, None)

        wallet_lower = wallet_address.lower()

        # Check for obviously fake patterns
        if wallet_lower == '0x' + '0' * 40:
            return (True, "Wallet address is null address")

        if wallet_lower == '0x' + 'f' * 40:
            return (True, "Wallet address is max address")

        # Check for repeating patterns (e.g., 0xabcabcabc...)
        hex_part = wallet_lower[2:]  # Remove 0x
        for chunk_size in [2, 3, 4]:
            chunk = hex_part[:chunk_size]
            if chunk * (40 // chunk_size) == hex_part[:chunk_size * (40 // chunk_size)]:
                return (True, "Wallet address has repeating pattern")

        return (False, None)

    @classmethod
    def analyze_registration(
        cls,
        username: str,
        email: str,
        wallet_address: Optional[str] = None
    ) -> tuple[int, List[str]]:
        """
        Analyze registration data for spam indicators.

        Returns:
            Tuple of (spam_score 0-100, list of reasons)
        """
        spam_score = 0
        reasons = []

        # Check username
        is_suspicious, reason = cls.check_username(username)
        if is_suspicious:
            spam_score += 30
            reasons.append(f"Username: {reason}")

        # Check email
        is_suspicious, reason = cls.check_email(email)
        if is_suspicious:
            spam_score += 40
            reasons.append(f"Email: {reason}")

        # Check wallet
        is_suspicious, reason = cls.check_wallet_pattern(wallet_address)
        if is_suspicious:
            spam_score += 20
            reasons.append(f"Wallet: {reason}")

        return (min(spam_score, 100), reasons)


# Spam detection threshold
SPAM_SCORE_THRESHOLD = 50  # Block if score >= 50


# ==========================================
# PYDANTIC SCHEMAS
# ==========================================

class UserCreate(BaseModel):
    """Schema for user registration."""
    username: str
    email: EmailStr
    password: str
    wallet_address: Optional[str] = None
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None

    @field_validator('username')
    @classmethod
    def username_valid(cls, v):
        if len(v) < 3:
            raise ValueError('Username must be at least 3 characters')
        if len(v) > 50:
            raise ValueError('Username must be less than 50 characters')
        return v.lower().strip()

    @field_validator('password')
    @classmethod
    def password_valid(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one digit')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must contain at least one special character')
        return v

    @field_validator('wallet_address')
    @classmethod
    def wallet_address_valid(cls, v):
        if v:
            normalized = v.lower().strip()
            if not re.match(r"^0x[a-f0-9]{40}$", normalized):
                raise ValueError('Invalid Ethereum wallet address')
            return normalized
        return None


class UserLogin(BaseModel):
    """Schema for user login."""
    username: str
    password: str


class Token(BaseModel):
    """JWT token response."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    """User data response (excludes password)."""
    id: str
    username: str
    email: str
    role: str
    wallet_address: Optional[str]
    warning_count: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenData(BaseModel):
    """JWT token payload data."""
    username: str
    user_id: str
    role: str = "user"


# ==========================================
# ACCOUNT LOCKOUT
# ==========================================

def _check_login_lockout(username: str) -> None:
    now = time.time()
    with _login_attempts_lock:
        attempts = _login_attempts.get(username, [])
        attempts = [t for t in attempts if now - t < LOGIN_LOCKOUT_MINUTES * 60]
        _login_attempts[username] = attempts
        if len(attempts) >= MAX_LOGIN_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Account locked due to too many failed login attempts. Try again in {LOGIN_LOCKOUT_MINUTES} minutes."
            )

def _record_login_attempt(username: str, success: bool) -> None:
    with _login_attempts_lock:
        if success:
            _login_attempts.pop(username, None)
        else:
            _login_attempts[username].append(time.time())


# ==========================================
# UTILITY FUNCTIONS
# ==========================================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its bcrypt hash."""
    try:
        if not hashed_password:
            return False
        return pwd_context.verify(plain_password, hashed_password)
    except ValueError as e:
        logger.error(f"Password verification error (bcrypt/passlib incompatibility?): {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error during password verification: {e}")
        return False


def get_password_hash(password: str) -> str:
    """Hash a password for storage."""
    try:
        return pwd_context.hash(password)
    except ValueError as e:
        logger.error(f"Password hashing error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Authentication system internal error. Please contact administrator."
        )


def _generate_unique_wallet_address(db: Session) -> str:
    """Generate a unique Ethereum-like address not used by users/wallets."""
    for _ in range(20):
        candidate = "0x" + secrets.token_hex(20)
        user_exists = db.query(User.id).filter(User.wallet_address == candidate).first() is not None
        wallet_exists = db.query(Wallet.id).filter(Wallet.address == candidate).first() is not None
        if not user_exists and not wallet_exists:
            return candidate
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Unable to allocate a unique wallet address at the moment"
    )


def _fetch_login_user(db: Session, normalized_username: str) -> Optional[Dict[str, object]]:
    """Fetch user for login with a resilient path for SQLite schema drift."""
    bind = db.get_bind()
    dialect = bind.dialect.name if bind is not None else ""

    # SQLite fallback path: query only minimal columns that may exist in legacy DBs.
    if dialect == "sqlite":
        columns_info = db.execute(text("PRAGMA table_info(users)")).fetchall()
        column_names = {str(row[1]) for row in columns_info}

        required_columns = {"id", "username", "email", "password_hash"}
        if not required_columns.issubset(column_names):
            missing = ", ".join(sorted(required_columns - column_names))
            raise SQLAlchemyError(f"users table missing required columns: {missing}")

        role_expr = "role" if "role" in column_names else "'user'"
        is_active_expr = "is_active" if "is_active" in column_names else "1"

        row = db.execute(
            text(
                f"""
                SELECT id, username, email, password_hash,
                       {role_expr} AS role,
                       {is_active_expr} AS is_active
                FROM users
                WHERE lower(username) = :u OR lower(email) = :u
                LIMIT 1
                """
            ),
            {"u": normalized_username},
        ).mappings().first()

        return dict(row) if row else None

    # Default ORM path for Postgres and other DBs.
    user = db.query(User).filter(
        (User.username == normalized_username) |
        (User.email == normalized_username)
    ).first()
    if not user:
        return None

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "password_hash": user.password_hash,
        "role": user.role,
        "organization_id": user.organization_id,
        "is_active": user.is_active,
    }


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, _get_jwt_secret(), algorithm=ALGORITHM)
    return encoded_jwt


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Get current user from JWT token.

    Returns None if no token or invalid token (allows optional auth).
    Raises HTTPException if token exists but is invalid.
    """
    if not token:
        return None

    try:
        payload = jwt.decode(token, _get_jwt_secret(), algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_uuid = _safe_parse_user_id(user_id)
    user = db.query(User).filter(User.id == user_id_uuid).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )

    return user


def require_auth(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Require authentication - raises 401 if not authenticated."""
    _ensure_auth_enabled()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_current_user(token, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def optional_auth(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Optional authentication - returns User or None without raising errors."""
    if not token:
        return None
    try:
        return get_current_user(token, db)
    except HTTPException:
        return None


def require_admin(
    current_user: User = Depends(require_auth)
) -> User:
    """Require admin-capable role - raises 403 if not admin-capable."""
    if current_user.role not in ("admin", "system_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user


def admin_or_analyst(
    current_user: User = Depends(require_auth)
) -> User:
    """Require admin, analyst, or governance role - raises 403 otherwise."""
    if current_user.role not in ("admin", "system_admin", "analyst", "security_analyst", "compliance_risk_manager", "ai_data_engineer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or analyst privileges required"
        )
    return current_user


# ==========================================
# AUTH ENDPOINTS
# ==========================================

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@router.post("/_legacy_/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_data: UserCreate, request: Request, db: Session = Depends(get_db)):
    """
    Register a new user account.

    Rate limited to prevent spam account creation:
    - Max 3 registrations per IP per hour
    - Minimum 30 seconds between registrations

    Args:
        user_data: Username, email, password, and optional wallet address
        request: FastAPI request for IP extraction

    Returns:
        Created user data (without password)
    """

    # Get client IP for rate limiting
    client_ip = request.client.host if request.client else "unknown"
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()

    # Check rate limit
    allowed, error_msg, retry_after = registration_limiter.check_rate_limit(client_ip)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_msg,
            headers={"Retry-After": str(retry_after)} if retry_after else None
        )

    # Check for spam account patterns
    spam_score, spam_reasons = SpamAccountDetector.analyze_registration(
        username=user_data.username,
        email=user_data.email,
        wallet_address=user_data.wallet_address
    )

    if spam_score >= SPAM_SCORE_THRESHOLD:
        logger.warning(
            f"Blocked spam registration from {client_ip}: "
            f"username={user_data.username}, score={spam_score}, reasons={spam_reasons}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration blocked: {'; '.join(spam_reasons)}"
        )

    # Check if username exists
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    # Check if email exists
    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Handle organization
    org_id = user_data.organization_id
    if not org_id and user_data.organization_name:
        # Create new organization if name provided
        from app.models.models import Organization
        org_slug = re.sub(r"[^a-z0-9]+", "-", user_data.organization_name.lower()).strip("-") or "organization"
        existing_org = db.query(Organization).filter(Organization.slug == org_slug).first()
        if existing_org:
            org_id = str(existing_org.id)
        else:
            new_org = Organization(
                name=user_data.organization_name,
                slug=org_slug,
                is_active=True
            )
            db.add(new_org)
            db.flush()
            org_id = str(new_org.id)

    # If wallet not provided, auto-provision a unique wallet address.
    wallet_address = user_data.wallet_address.lower() if user_data.wallet_address else _generate_unique_wallet_address(db)

    # Check if wallet address exists on another user account.
    existing_wallet = db.query(User).filter(User.wallet_address == wallet_address).first()
    if existing_wallet:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wallet address already linked to another account"
        )

    # Ensure a wallet profile row exists for this address (new or existing).
    wallet_profile = db.query(Wallet).filter(Wallet.address == wallet_address).first()
    if not wallet_profile:
        wallet_profile = Wallet(
            id=uuid.uuid4(),
            address=wallet_address,
            label=f"{user_data.username} wallet",
            entity_type="User",
            account_status="active",
            risk_score=0.0,
            risk_category=None,
            total_transactions=0,
            total_value_sent=0,
            total_value_received=0,
            first_seen_at=datetime.now(timezone.utc),
            last_activity_at=datetime.now(timezone.utc),
            notes="Auto-created during user registration",
        )
        db.add(wallet_profile)

    # Create new user
    new_user = User(
        id=uuid.uuid4(),
        username=user_data.username,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        wallet_address=wallet_address,
        role="user",
        organization_id=uuid.UUID(org_id) if org_id else None,
        is_active=True,
        warning_count=0
    )

    db.add(new_user)
    db.flush()  # Get new_user.id before commit

    # Auto-create UserProfile with default preferences
    from app.models.models import UserProfile as UserProfileModel
    user_profile = UserProfileModel(
        user_id=new_user.id,
        full_name=user_data.username,
        phone=None,
        address=None,
        preferences={"email": True, "push": False, "sms": False}
    )
    db.add(user_profile)

    db.commit()
    db.refresh(new_user)

    # Auto-link this account to existing wallet-centric records.
    _link_registered_user_wallet(db, new_user)
    db.commit()
    db.refresh(new_user)

    # Record successful registration for rate limiting
    registration_limiter.record_registration(client_ip)

    return UserResponse(
        id=str(new_user.id),
        username=new_user.username,
        email=new_user.email,
        role=new_user.role,
        wallet_address=new_user.wallet_address,
        warning_count=new_user.warning_count,
        is_active=new_user.is_active,
        created_at=new_user.created_at
    )


@router.post("/login", response_model=Token)
def login_user(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Authenticate user and return JWT token.

    Accepts username or email in the username field.

    Args:
        form_data: OAuth2 form with username and password

    Returns:
        JWT access token
    """

    normalized_username = (form_data.username or "").strip().lower()
    if not normalized_username or not form_data.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username/email and password are required"
        )

    _check_login_lockout(normalized_username)

    try:
        user = _fetch_login_user(db, normalized_username)

        if not user or not verify_password(form_data.password, str(user.get("password_hash") or "")):
            _record_login_attempt(normalized_username, False)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        _record_login_attempt(normalized_username, True)

        if not bool(user.get("is_active", True)):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is disabled. Contact admin for assistance."
            )

        # Update last login
        try:
            db.execute(
                text("UPDATE users SET last_login_at = :ts WHERE id = :user_id"),
                {"ts": datetime.now(timezone.utc), "user_id": str(user.get("id"))},
            )
            db.commit()
        except Exception:
            # Don't block login if legacy schema does not have last_login_at.
            db.rollback()

        # Create access token
        access_token = create_access_token(
            data={
                "sub": str(user.get("id")),
                "username": str(user.get("username") or normalized_username),
                "role": str(user.get("role") or "user"),
                "org_id": str(user.get("organization_id")) if user.get("organization_id") else None,
            }
        )

        return Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error during login for username=%s", normalized_username)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is temporarily unavailable. Please try again in a moment."
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Unexpected error during login for username=%s", form_data.username)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed due to an internal error: {exc.__class__.__name__}"
        ) from exc


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(require_auth)):
    """
    Get current authenticated user's information.

    Returns:
        Current user data (without password)
    """

    return UserResponse(
        id=str(current_user.id),
        username=current_user.username,
        email=current_user.email,
        role=current_user.role,
        wallet_address=current_user.wallet_address,
        warning_count=current_user.warning_count,
        is_active=current_user.is_active,
        created_at=current_user.created_at
    )


@router.post("/logout")
def logout_user():
    """
    Logout user (client-side token removal).

    JWT tokens are stateless, so logout is handled client-side
    by removing the token from storage.

    Returns:
        Success message
    """
    return {"message": "Successfully logged out"}


@router.post("/refresh")
def refresh_token(current_user: User = Depends(require_auth)):
    """
    Refresh JWT access token.

    Returns:
        New JWT token
    """
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    new_token = create_access_token(
        data={
            "sub": str(current_user.id),
            "username": current_user.username,
            "role": current_user.role,
            "org_id": str(current_user.organization_id) if current_user.organization_id else None,
        },
        expires_delta=access_token_expires
    )
    return {
        "access_token": new_token,
        "token_type": "bearer",
        "expires_in": int(access_token_expires.total_seconds())
    }


# ==========================================
# CSRF PROTECTION
# ==========================================

CSRF_TOKEN_EXPIRE_SECONDS = 3600  # 1 hour


def generate_csrf_token(user_id: str) -> str:
    """Generate a short-lived CSRF token signed with the JWT secret."""
    expire = datetime.now(timezone.utc) + timedelta(seconds=CSRF_TOKEN_EXPIRE_SECONDS)
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": "csrf"},
        _get_jwt_secret(),
        algorithm=ALGORITHM,
    )


def verify_csrf_token(csrf_token: str) -> Optional[str]:
    """
    Verify a CSRF token and return the user_id if valid.
    Returns None if invalid or expired.
    """
    try:
        payload = jwt.decode(csrf_token, _get_jwt_secret(), algorithms=[ALGORITHM])
        if payload.get("type") != "csrf":
            return None
        return payload.get("sub")
    except JWTError:
        return None


def require_csrf(request: Request) -> None:
    """
    Dependency that checks CSRF token on mutating requests
    when the request carries a cookie but no Authorization header.

    Usage:
        @app.post("/endpoint")
        def my_endpoint(..., _: None = Depends(require_csrf)):
    """
    auth_header = request.headers.get("Authorization", "")
    csrf_cookie = request.cookies.get("auth_token")
    csrf_header = request.headers.get("X-CSRF-Token", "")

    # Only check CSRF if there's a cookie but no bearer token
    if csrf_cookie and not auth_header.startswith("Bearer "):
        if not csrf_header or not verify_csrf_token(csrf_header):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token missing or invalid",
            )


@router.get("/csrf-token", tags=["Authentication"])
def get_csrf_token(current_user: User = Depends(require_auth)):
    """Get a CSRF token for state-changing requests."""
    token = generate_csrf_token(str(current_user.id))
    return {"csrf_token": token, "expires_in": CSRF_TOKEN_EXPIRE_SECONDS}


@router.post("/validate")
def validate_token(current_user: User = Depends(require_auth)):
    """
    Validate the current JWT token.

    Returns:
        Token validity information
    """
    return {
        "valid": True,
        "user_id": str(current_user.id),
        "username": current_user.username,
        "role": current_user.role,
        "org_id": str(current_user.organization_id) if current_user.organization_id else None
    }


@router.get("/profile/full", tags=["Profile"])
def get_profile_full(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": current_user.email,
        "wallet_address": current_user.wallet_address,
        "full_name": profile.full_name or "",
        "phone": profile.phone or "",
        "address": profile.address or "",
        "preferences": profile.preferences or {"email": True, "push": False, "sms": False}
    }


@router.patch("/profile/details", tags=["Profile"])
def update_profile_details(
    payload: UpdateProfileDetailsRequest,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
        db.flush()
    if payload.full_name is not None:
        profile.full_name = payload.full_name
    if payload.phone is not None:
        profile.phone = payload.phone
    if payload.address is not None:
        profile.address = payload.address
    db.commit()
    return {"success": True, "full_name": profile.full_name, "phone": profile.phone, "address": profile.address}


@router.patch("/profile/preferences", tags=["Profile"])
def update_profile_preferences(
    payload: UpdateProfilePreferencesRequest,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
        db.flush()
    prefs = profile.preferences or {}
    if payload.email is not None:
        prefs["email"] = payload.email
    if payload.push is not None:
        prefs["push"] = payload.push
    if payload.sms is not None:
        prefs["sms"] = payload.sms
    profile.preferences = prefs
    db.commit()
    return {"success": True, "preferences": prefs}


# ============================================================================
# PASSWORD RESET ENDPOINTS
# ============================================================================

from app.core.config import REDIS_URL
import secrets
import hashlib
import time

@router.post("/auth/forgot-password", tags=["Auth"])
def forgot_password(
    payload: Dict[str, Any],
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Generate password reset token for user."""
    email = payload.get("email", "").strip().lower()
    
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    user = db.query(User).filter(User.email.ilike(email)).first()
    if not user:
        # Don't reveal if user exists
        return {"success": True, "message": "If email exists, reset link will be sent"}
    
    # Generate reset token
    reset_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(reset_token.encode()).hexdigest()
    expires_at = int(time.time()) + 3600  # 1 hour
    
    # Store in Redis or in-memory
    if cache:
        cache.setex(f"pwd_reset:{user.id}", 3600, f"{token_hash}:{expires_at}:{user.id}")
    
    # In production, send email with reset_token
    # For now, return token for testing purposes
    return {
        "success": True,
        "message": "Reset token generated",
        "reset_token": reset_token if os.getenv("DEV_MODE", "false").lower() == "true" else None
    }


@router.post("/auth/reset-password", tags=["Auth"])
def reset_password(
    payload: Dict[str, Any],
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Reset password using token."""
    token = payload.get("token", "").strip()
    new_password = payload.get("new_password", "")
    
    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Token and new password are required")
    
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    # Find user by token
    found_user_id = None
    if cache:
        for key in cache.scan_iter(match="pwd_reset:*"):
            value = cache.get(key)
            if value and value.startswith(token_hash):
                found_user_id = value.split(":")[-1]
                cache.delete(key)
                break
    
    if not found_user_id:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    user = db.query(User).filter(User.id == found_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update password
    user.password_hash = get_password_hash(new_password)
    db.commit()
    
    return {"success": True, "message": "Password reset successfully"}
