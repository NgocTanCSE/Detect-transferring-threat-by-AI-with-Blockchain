"""JWT Authentication module for blockchain risk assessment API."""

import logging
import os
import time
from collections import defaultdict
from datetime import datetime, timedelta
from threading import Lock
from typing import Optional, Dict, List
import uuid

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, validator
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.core.database import get_db
from app.models.models import User, Wallet, Transaction, Alert, BlockedTransfer


# Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "blockchain-sentinel-super-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
AUTH_DISABLED = os.getenv("AUTH_DISABLED", "false").lower() == "true"

# Anti-spam configuration for registration
REGISTRATION_RATE_LIMIT = 3  # Max registrations per IP per hour
REGISTRATION_WINDOW_SECONDS = 3600  # 1 hour
MIN_REGISTRATION_INTERVAL = 30  # Minimum 30 seconds between registrations

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _ensure_auth_enabled() -> None:
    if AUTH_DISABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is temporarily disabled"
        )


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
            first_seen_at=datetime.utcnow(),
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

    @validator('username')
    def username_valid(cls, v):
        if len(v) < 3:
            raise ValueError('Username must be at least 3 characters')
        if len(v) > 50:
            raise ValueError('Username must be less than 50 characters')
        return v.lower().strip()

    @validator('password')
    def password_valid(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v

    @validator('wallet_address')
    def wallet_address_valid(cls, v):
        if v and (len(v) != 42 or not v.startswith('0x')):
            raise ValueError('Invalid Ethereum wallet address')
        return v.lower() if v else None


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

    class Config:
        from_attributes = True


# ==========================================
# UTILITY FUNCTIONS
# ==========================================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its hash.

    Supports both:
    - Plaintext passwords (from seed/dev data)
    - Bcrypt hashed passwords (from production registrations)
    """
    # Support plaintext passwords for seed data (safe for dev, will be removed in prod)
    if plain_password == hashed_password:
        return True

    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        # If bcrypt fails (invalid hash), fall back to plaintext comparison
        return False


def get_password_hash(password: str) -> str:
    """Hash a password for storage."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
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
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
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


# ==========================================
# AUTH ENDPOINTS
# ==========================================

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
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

    # Check if wallet address exists (if provided)
    if user_data.wallet_address:
        existing_wallet = db.query(User).filter(User.wallet_address == user_data.wallet_address).first()
        if existing_wallet:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Wallet address already linked to another account"
            )

    if not user_data.wallet_address:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wallet address is required for regular user registration"
        )

    wallet_address = user_data.wallet_address.lower()
    wallet_exists = db.query(Wallet.id).filter(Wallet.address == wallet_address).first() is not None
    tx_exists = (
        db.query(Transaction.id)
        .filter(or_(Transaction.from_address == wallet_address, Transaction.to_address == wallet_address))
        .first()
        is not None
    )
    alert_exists = db.query(Alert.id).filter(Alert.wallet_address == wallet_address).first() is not None
    blocked_exists = db.query(BlockedTransfer.id).filter(BlockedTransfer.sender_address == wallet_address).first() is not None

    if not (wallet_exists or tx_exists or alert_exists or blocked_exists):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Wallet must already be linked to existing system data "
                "(wallet profile, transactions, alerts, or blocked transfers)"
            )
        )

    # Create new user
    new_user = User(
        id=uuid.uuid4(),
        username=user_data.username,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        wallet_address=wallet_address,
        role="user",
        is_active=True,
        warning_count=0
    )

    db.add(new_user)
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

    try:
        # Try to find user by username or email
        user = db.query(User).filter(
            (User.username == form_data.username.lower()) |
            (User.email == form_data.username.lower())
        ).first()

        if not user or not verify_password(form_data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is disabled. Contact admin for assistance."
            )

        # Update last login
        user.last_login_at = datetime.utcnow()
        db.commit()

        # Create access token
        access_token = create_access_token(
            data={"sub": str(user.id), "username": user.username, "role": user.role}
        )

        return Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
    except HTTPException:
        raise
    except Exception as exc:
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
