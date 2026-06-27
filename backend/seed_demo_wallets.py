"""Seed demo wallets and transactions for traffic simulation."""

import uuid
import random
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.models import models as m
from app.core.database import engine, Base


def seed():
    Base.metadata.create_all(bind=engine)
    session: Session = Session(bind=engine)
    try:
        # Smurf accounts for money laundering simulation
        for _ in range(50):
            address = f"0x{uuid.uuid4().hex[:40]}"
            wallet = m.Wallet(
                id=str(uuid.uuid4()),
                address=address,
                risk_score=random.uniform(10, 50),
                account_status="active",
                total_transactions=0,
            )
            session.merge(wallet)

        # Suspicious hubs (will trigger AI detection)
        for addr in [
            "0x4444444444444444444444444444444444444444",
            "0x5555555555555555555555555555555555555555",
            "0x9999999999999999999999999999999999999999",
        ]:
            wallet = m.Wallet(
                id=str(uuid.uuid4()),
                address=addr,
                risk_score=random.uniform(40, 80),
                account_status="under_review",
            )
            session.merge(wallet)

        session.commit()
        print("Demo wallets seeded: 50 smurfs + 3 hubs")
    except Exception as e:
        session.rollback()
        print(f"Seed failed: {e}")
    finally:
        session.close()


if __name__ == "__main__":
    seed()