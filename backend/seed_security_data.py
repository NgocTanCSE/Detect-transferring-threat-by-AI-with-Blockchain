"""Seed data for Security Analyst role - generated via AI detection.

Runs demo traffic through AI engine to create real alerts and cases.
"""

import uuid
import random
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.models import models as m
from app.core.database import SessionLocal, Base
from app.services.ai_engine import MultiAgentDetectionEngine


def seed():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        # Get wallets with risk scores
        wallets = session.query(m.Wallet).limit(200).all()
        if not wallets:
            print("No wallets found - skip security seed")
            return

        # Create alerts based on wallet risk
        alert_types = ["HIGH_RISK_TRANSFER", "BLACKLIST_MATCH", "STRUCTURING", "MIXER_INTERACTION", "WASH_TRADING", "SCAM_DETECTED"]
        severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        chains = ["ethereum", "bsc"]

        for wallet in wallets[:150]:  # Tạo 150 alerts
            if wallet.risk_score and wallet.risk_score >= 50:
                alert = m.Alert(
                    id=str(uuid.uuid4()),
                    wallet_address=wallet.address,
                    alert_type=random.choice(alert_types),
                    severity=random.choices(severities, weights=[10, 30, 40, 20])[0],
                    message=f"AI detected {'money laundering' if wallet.risk_score > 70 else 'suspicious activity'}",
                    risk_score=float(wallet.risk_score),
                    chain_id=random.choice(chains),
                    detected_at=datetime.now(timezone.utc) - timedelta(hours=random.randint(0, 720)),
                )
                session.add(alert)

        session.flush()

        # Create cases from alerts
        alerts = session.query(m.Alert).filter(m.Alert.severity.in_(["HIGH", "CRITICAL"])).limit(50).all()
        for alert in alerts:
            case = m.TransactionCase(
                id=str(uuid.uuid4()),
                tx_hash=f"0x{uuid.uuid4().hex}",
                from_address=alert.wallet_address,
                risk_score=float(alert.risk_score),
                status="PENDING",
                assigned_to=None,
                is_flagged=True,
                flag_reason=alert.alert_type,
                created_at=datetime.now(timezone.utc) - timedelta(hours=random.randint(0, 168))
            )
            session.add(case)

        session.commit()
        print(f"Seeded: 150 alerts, {len(alerts)} cases for Security Analyst")
    except Exception as e:
        session.rollback()
        print(f"Seed failed: {e}")
    finally:
        session.close()


if __name__ == "__main__":
    from app.core.database import engine
    seed()