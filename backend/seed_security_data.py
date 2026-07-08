"""Seed data for Security Analyst role - generated via AI detection."""

import uuid
import random
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.models import models as m
from app.core.database import engine, SessionLocal, Base


def seed():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        existing_alerts = session.query(m.Alert).count()
        if existing_alerts >= 300:
            print(f"  Alerts: {existing_alerts} already exist, skipping security seed")
            return

        wallets = session.query(m.Wallet).limit(200).all()
        if not wallets:
            print("No wallets found - skip security seed")
            return

        alert_types = ["HIGH_RISK_TRANSFER", "BLACKLIST_MATCH", "STRUCTURING", "MIXER_INTERACTION", "WASH_TRADING", "SCAM_DETECTED"]
        severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        chains = ["ethereum", "bsc"]

        for wallet in wallets[:150]:
            if wallet.risk_score and wallet.risk_score >= 50:
                alert = m.Alert(
                    id=uuid.UUID(str(uuid.uuid4())),
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

        existing_cases = session.query(m.TransactionCase).count()
        if existing_cases < 50:
            alerts = session.query(m.Alert).filter(m.Alert.severity.in_(["HIGH", "CRITICAL"])).limit(50).all()
            users = session.query(m.User).all()
            for alert in alerts:
                case = m.TransactionCase(
                    id=uuid.UUID(str(uuid.uuid4())),
                    tx_hash=f"0x{uuid.uuid4().hex}",
                    action="ASSIGN",
                    state="PENDING",
                    note=f"Alert: {alert.alert_type}",
                    analyst_id=random.choice(users).id if users else None,
                )
                session.add(case)

        session.commit()
        print(f"Security seed complete")
    except Exception as e:
        session.rollback()
        print(f"Seed failed: {e}")
    finally:
        session.close()


if __name__ == "__main__":
    from app.core.database import engine
    seed()