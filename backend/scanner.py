"""Background wallet scanner service for continuous risk monitoring."""

import logging
import time
import random
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine, Base, ensure_schema
from app.models.models import Wallet, Blacklist, Alert
from app.services.ai_engine import MultiAgentDetectionEngine
from blockchain_client import fetch_wallet_history

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

SCAN_INTERVAL_SECONDS = 10
ALERT_RISK_THRESHOLD = 80


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

    session.commit()
    logger.warning(f"🚨 ALERT CREATED: {wallet_address} | Risk: {risk_score}% | Level: {risk_level}")


def scan_wallet(session: Session, wallet_address: str) -> None:
    """
    Perform risk assessment on a wallet address.

    Args:
        session: Database session
        wallet_address: Address to scan
    """
    if not wallet_address:
        return

    transactions = fetch_wallet_history(wallet_address, max_count=100)

    ai_engine = MultiAgentDetectionEngine(database_session=session)
    risk_result = ai_engine.analyze_wallet(wallet_address, transactions)
    risk_score = risk_result["total_score"]
    risk_level = risk_result["risk_level"]

    logger.info(f"Scanned {wallet_address[:10]}... | Risk: {risk_score}% | Level: {risk_level}")

    if risk_score >= ALERT_RISK_THRESHOLD:
        create_alert(session, wallet_address, risk_score, risk_level)


def main():
    """Main scanner loop."""
    logger.info("🔍 Blockchain Scanner Service Starting...")
    logger.info(f"Scan interval: {SCAN_INTERVAL_SECONDS}s | Alert threshold: {ALERT_RISK_THRESHOLD}%")

    Base.metadata.create_all(bind=engine)
    ensure_schema()

    scan_count = 0

    try:
        while True:
            scan_count += 1
            session = SessionLocal()

            try:
                target_wallet = get_random_target_wallet(session)
                if not target_wallet:
                    logger.info(f"[Scan #{scan_count}] No wallets available to scan")
                else:
                    logger.info(f"[Scan #{scan_count}] Analyzing wallet: {target_wallet[:10]}...")
                    scan_wallet(session, target_wallet)

            except Exception as scan_error:
                logger.error(f"Scan error: {scan_error}")
            finally:
                session.close()

            time.sleep(SCAN_INTERVAL_SECONDS)

    except KeyboardInterrupt:
        logger.info("Scanner service stopped by user")
    except Exception as fatal_error:
        logger.critical(f"Scanner service crashed: {fatal_error}")
        raise


if __name__ == "__main__":
    main()
