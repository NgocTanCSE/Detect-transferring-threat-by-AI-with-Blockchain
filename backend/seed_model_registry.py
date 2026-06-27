"""Seed model registry with trained ML model artifacts."""

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import models as m
from app.core.database import engine, Base


def _uuid_str() -> str:
    return str(uuid.uuid4())


def seed():
    Base.metadata.create_all(bind=engine)
    session: Session = Session(bind=engine)
    try:
        _seed_model_registry(session)
        session.commit()
        print("Model registry seed complete: 1 active model")
    except Exception as e:
        session.rollback()
        print(f"Model registry seed failed: {e}")
        raise
    finally:
        session.close()


def _seed_model_registry(session: Session):
    existing_count = session.query(m.ModelRegistry).count()
    if existing_count >= 1:
        print("  ModelRegistry already seeded, skipping")
        return

    record = m.ModelRegistry(
        id=_uuid_str(),
        model_name="risk_predictor",
        version="v1.0",
        artifact_uri="/app/services/risk_model.pkl",
        framework="pkl",
        is_active=True,
        promoted_by=None,
        promoted_at=datetime.now(timezone.utc),
    )
    session.add(record)
    session.flush()
    print("  ModelRegistry: 1 active model added")


if __name__ == "__main__":
    seed()