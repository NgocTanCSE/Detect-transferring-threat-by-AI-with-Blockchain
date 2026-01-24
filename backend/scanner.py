"""Background wallet scanner service for continuous risk monitoring.

Enhanced with:
- Retry logic with exponential backoff
- Structured logging for production
- Graceful shutdown handling
- Health check endpoint support
"""

import logging
import time
import random
import signal
import sys
from datetime import datetime
from functools import wraps
from typing import Optional, Callable, Any

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal, engine, Base, ensure_schema
from app.models.models import Wallet, Blacklist, Alert
from app.services.ai_engine import MultiAgentDetectionEngine
from blockchain_client import fetch_wallet_history

# Structured logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('scanner')

# Configuration
SCAN_INTERVAL_SECONDS = 10
ALERT_RISK_THRESHOLD = 80
MAX_RETRIES = 3
INITIAL_RETRY_DELAY = 1.0
MAX_RETRY_DELAY = 30.0

# Graceful shutdown flag
_shutdown_requested = False


def retry_with_backoff(
    max_retries: int = MAX_RETRIES,
    initial_delay: float = INITIAL_RETRY_DELAY,
    max_delay: float = MAX_RETRY_DELAY,
    exceptions: tuple = (Exception,)
) -> Callable:
    """
    Decorator for retry logic with exponential backoff.

    Args:
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay between retries in seconds
        max_delay: Maximum delay cap
        exceptions: Tuple of exceptions to catch and retry
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            delay = initial_delay
            last_exception = None

            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_retries:
                        logger.warning(
                            f"[RETRY] {func.__name__} failed (attempt {attempt + 1}/{max_retries + 1}): {e}"
                        )
                        time.sleep(delay)
                        delay = min(delay * 2, max_delay)  # Exponential backoff
                    else:
                        logger.error(f"[FAILED] {func.__name__} exhausted all retries: {e}")

            raise last_exception
        return wrapper
    return decorator


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully."""
    global _shutdown_requested
    signal_name = signal.Signals(signum).name
    logger.info(f"Received {signal_name}, initiating graceful shutdown...")
    _shutdown_requested = True


def get_random_target_wallet(session: Session) -> str:
    """
    Select a wallet address to scan.

    Prioritizes blacklisted wallets, falls back to random generation.

    Args:
        session: Database session

    Returns:
        Wallet address string
    """
    # Prefer known wallets in DB (real data), then blacklist.
    wallets = session.query(Wallet).all()
    if wallets:
        selected = random.choice(wallets)
        return selected.address

    blacklist_wallets = session.query(Blacklist).all()
    if blacklist_wallets:
        selected = random.choice(blacklist_wallets)
        return selected.address

    # Nothing to scan yet
    return ""


def create_alert(session: Session, wallet_address: str, risk_score: float, risk_level: str) -> None:
    """
    Create alert record in database for high-risk wallet detection.
    Also auto-updates wallet status based on risk score.

    Args:
        session: Database session
        wallet_address: Address that triggered alert
        risk_score: Calculated risk score
        risk_level: Risk classification level
    """
    alert = Alert(
        wallet_address=wallet_address,
        alert_type="HIGH_RISK_DETECTION",
        severity=risk_level,
        message=f"Scanner detected suspicious activity from wallet {wallet_address}",
        risk_score=risk_score,
        detected_at=datetime.utcnow()
    )
    session.add(alert)

    wallet = session.query(Wallet).filter(Wallet.address == wallet_address).first()
    if not wallet:
        wallet = Wallet(address=wallet_address)
        session.add(wallet)

    wallet.risk_score = max(float(wallet.risk_score or 0.0), float(risk_score or 0.0))
    wallet.last_activity_at = datetime.utcnow()
    wallet.updated_at = datetime.utcnow()

    # Auto-update wallet status based on risk score
    if risk_score >= 90:
        wallet.account_status = 'frozen'
        wallet.flagged_at = datetime.utcnow()
        wallet.flagged_by = 'SCANNER_AUTO_FREEZE'
        logger.warning(f"WALLET_FROZEN | address={wallet_address} | risk={risk_score}%")
    elif risk_score >= 80:
        if wallet.account_status not in ['frozen']:  # Don't downgrade frozen
            wallet.account_status = 'suspended'
            wallet.flagged_at = datetime.utcnow()
            wallet.flagged_by = 'SCANNER_AUTO_SUSPEND'
            logger.warning(f"WALLET_SUSPENDED | address={wallet_address} | risk={risk_score}%")
    elif risk_score >= 50:
        if wallet.account_status not in ['frozen', 'suspended']:  # Don't downgrade
            wallet.account_status = 'under_review'
            logger.info(f"WALLET_REVIEW | address={wallet_address} | risk={risk_score}%")

    session.commit()
    logger.warning(f"ALERT_CREATED | address={wallet_address} | risk={risk_score}% | level={risk_level}")


@retry_with_backoff(max_retries=2, exceptions=(Exception,))
def fetch_transactions_with_retry(wallet_address: str) -> list:
    """Fetch wallet transactions with retry logic."""
    return fetch_wallet_history(wallet_address, max_count=100)


def scan_wallet(session: Session, wallet_address: str) -> Optional[dict]:
    """
    Perform risk assessment on a wallet address.

    Args:
        session: Database session
        wallet_address: Address to scan

    Returns:
        Risk result dict or None if skipped
    """
    if not wallet_address:
        return None

    try:
        transactions = fetch_transactions_with_retry(wallet_address)
    except Exception as e:
        logger.error(f"FETCH_FAILED | address={wallet_address[:10]}... | error={e}")
        return None

    try:
        ai_engine = MultiAgentDetectionEngine(database_session=session)
        risk_result = ai_engine.analyze_wallet(wallet_address, transactions)
        risk_score = risk_result["total_score"]
        risk_level = risk_result["risk_level"]
        model_used = risk_result.get("model", "unknown")

        logger.info(
            f"SCAN_COMPLETE | address={wallet_address[:10]}... | "
            f"risk={risk_score}% | level={risk_level} | model={model_used}"
        )

        if risk_score >= ALERT_RISK_THRESHOLD:
            create_alert(session, wallet_address, risk_score, risk_level)

        return risk_result

    except Exception as e:
        logger.error(f"ANALYSIS_FAILED | address={wallet_address[:10]}... | error={e}")
        return None


def main():
    """Main scanner loop with graceful shutdown support."""
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    logger.info("=" * 60)
    logger.info("SCANNER_STARTING | Blockchain Risk Scanner v2.0")
    logger.info(f"CONFIG | interval={SCAN_INTERVAL_SECONDS}s | threshold={ALERT_RISK_THRESHOLD}%")
    logger.info("=" * 60)

    Base.metadata.create_all(bind=engine)
    ensure_schema()

    scan_count = 0
    error_count = 0
    alert_count = 0

    while not _shutdown_requested:
        scan_count += 1
        session = None

        try:
            session = SessionLocal()
            target_wallet = get_random_target_wallet(session)

            if not target_wallet:
                logger.debug(f"SCAN_SKIP | reason=no_wallets_available | scan={scan_count}")
            else:
                logger.info(f"SCAN_START | scan={scan_count} | target={target_wallet[:10]}...")
                result = scan_wallet(session, target_wallet)

                if result and result.get("total_score", 0) >= ALERT_RISK_THRESHOLD:
                    alert_count += 1

        except SQLAlchemyError as db_error:
            error_count += 1
            logger.error(f"DATABASE_ERROR | scan={scan_count} | error={db_error}")
            if session:
                session.rollback()

        except Exception as scan_error:
            error_count += 1
            logger.error(f"SCAN_ERROR | scan={scan_count} | error={scan_error}")

        finally:
            if session:
                session.close()

        # Log stats periodically
        if scan_count % 10 == 0:
            logger.info(
                f"STATS | scans={scan_count} | errors={error_count} | alerts={alert_count}"
            )

        # Sleep with shutdown check
        for _ in range(SCAN_INTERVAL_SECONDS):
            if _shutdown_requested:
                break
            time.sleep(1)

    # Graceful shutdown complete
    logger.info("=" * 60)
    logger.info(f"SCANNER_STOPPED | total_scans={scan_count} | errors={error_count} | alerts={alert_count}")
    logger.info("=" * 60)
    sys.exit(0)


if __name__ == "__main__":
    main()
