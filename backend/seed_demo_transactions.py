"""Seed demo transactions for AI detection testing."""

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
        # Get smurf wallets
        smurf_wallets = session.query(m.Wallet).filter(
            m.Wallet.address.like("0x%")
        ).limit(50).all()

        if len(smurf_wallets) < 10:
            print("Not enough wallets for transaction seeding")
            return

        # Money laundering pattern: Hub sends to many smurfs
        hub = m.Wallet(
            id=str(uuid.uuid4()),
            address="0x4444444444444444444444444444444444444444",
            risk_score=75.0,
            account_status="under_review"
        )
        session.merge(hub)
        session.flush()

        for i, smurf in enumerate(random.sample(smurf_wallets, min(30, len(smurf_wallets)))):
            tx = m.Transaction(
                id=str(uuid.uuid4()),
                tx_hash=f"0x{uuid.uuid4().hex}",
                from_address=hub.address,
                to_address=smurf.address,
                value=str(int(random.uniform(0.1, 2.0) * 10**18)),
                block_number=random.randint(1000000, 20000000),
                timestamp=datetime.now(timezone.utc) - timedelta(minutes=i*2),
                status=1,
                chain_id="ethereum"
            )
            session.add(tx)

        session.commit()
        print(f"Seeded {len(smurf_wallets)} demo transactions for AI detection")
    except Exception as e:
        session.rollback()
        print(f"Seed failed: {e}")
    finally:
        session.close()


if __name__ == "__main__":
    seed()