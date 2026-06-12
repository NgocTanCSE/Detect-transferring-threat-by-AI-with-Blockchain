"""Simple seed script for demo wallets.
Used only when the database is SQLite (local HF mode) or when a developer
wants to populate a fresh PostgreSQL instance for quick testing.
"""

import os
import uuid
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

# Import ORM models and Base
from app.models import models as m
from app.core.database import engine, Base, get_db


def _prepare_engine():
    # The DATABASE_URL env var is already used by the app's engine.
    # For a one‑off seed we reuse the same engine.
    return engine


def seed():
    db_engine = _prepare_engine()
    Base.metadata.create_all(bind=db_engine)  # ensure tables exist
    session: Session = Session(bind=db_engine)
    try:
        # Insert a few demo wallets if they do not exist
        demo_addresses = [
            "0xDEMO000000000000000000000000000000000001",
            "0xDEMO000000000000000000000000000000000002",
            "0xDEMO000000000000000000000000000000000003",
        ]
        for addr in demo_addresses:
            existing = session.query(m.Wallet).filter(m.Wallet.address == addr.lower()).first()
            if not existing:
                wallet = m.Wallet(
                    address=addr.lower(),
                    label=f"Demo Wallet {addr[-3:]}",
                    risk_score=0.0,
                    created_at=datetime.utcnow(),
                )
                session.add(wallet)
        session.commit()
        print(f"Seeded {len(demo_addresses)} demo wallets.")
    except Exception as e:
        session.rollback()
        print(f"Seed failed: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    seed()
