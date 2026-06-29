"""Seed feature store configurations for AI model inference pipeline."""

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
        _seed_feature_store_configs(session)
        session.commit()
        print("Feature store seed complete: 3 features seeded")
    except Exception as e:
        session.rollback()
        print(f"Feature store seed failed: {e}")
        raise
    finally:
        session.close()


def _seed_feature_store_configs(session: Session):
    """Seed feature store with essential ML features for risk detection."""
    features_data = [
        {
            "feature_key": "transaction_frequency_24h",
            "enabled": True,
            "expression": "count(transactions where timestamp >= now() - interval '24 hours')",
            "description": "Number of transactions in last 24 hours for wallet activity analysis",
        },
        {
            "feature_key": "risk_score_momentum",
            "enabled": True,
            "expression": "risk_score_current - risk_score_7d_avg",
            "description": "Change in risk score over 7-day rolling average",
        },
        {
            "feature_key": "blacklist_proximity",
            "enabled": True,
            "expression": "count(transactions where to_address in blacklist OR from_address in blacklist)",
            "description": "Number of connections to blacklisted addresses",
        },
    ]

    org = session.query(m.Organization).first()
    org_id = org.id if org else None
    users = session.query(m.User).all()

    for idx, feature in enumerate(features_data):
        existing = session.query(m.FeatureStoreConfig).filter(
            m.FeatureStoreConfig.feature_key == feature["feature_key"]
        ).first()
        if existing:
            continue

        record = m.FeatureStoreConfig(
            id=_uuid_str(),
            feature_key=feature["feature_key"],
            enabled=feature["enabled"],
            expression=feature["expression"],
            organization_id=org_id,
            owner_user_id=users[0].id if users else None,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        session.add(record)
        session.flush()
        print(f"  FeatureStoreConfigs: {feature['feature_key']} added")


if __name__ == "__main__":
    seed()