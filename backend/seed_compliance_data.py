"""Seed data for Compliance Risk Manager role - policy rules and audit trails."""

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
        existing_rules = session.query(m.PolicyRule).count()
        if existing_rules >= 20:
            print(f"  PolicyRules: {existing_rules} already exist, skipping")
        else:
            rule_names = ["AML_HIGH_RISK", "SANCTION_BLOCK", "VELOCITY_LIMIT", "STRUCTURE_THRESHOLD", "GEOGRAPHIC_RESTRICTION"]
            for i in range(20 - existing_rules):
                rule_name = f"{random.choice(rule_names)}_{i}" if i > 0 or existing_rules > 0 else random.choice(rule_names)
                existing = session.query(m.PolicyRule).filter(m.PolicyRule.rule_name == rule_name).first()
                if existing:
                    continue
                rule = m.PolicyRule(
                    id=uuid.UUID(str(uuid.uuid4())),
                    rule_name=rule_name,
                    description=f"Policy rule {i}",
                    min_risk_score=random.randint(60, 90),
                    block_blacklisted=random.random() > 0.3,
                    block_suspended=random.random() > 0.3,
                    notify_on_block=random.random() > 0.5,
                    priority=i,
                    is_active=True,
                    created_at=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 30))
                )
                session.add(rule)

        existing_audits = session.query(m.AuditLog).count()
        if existing_audits >= 1000:
            print(f"  AuditLogs: {existing_audits} already exist, skipping")
        else:
            action_types = ["LOGIN", "TRANSFER", "RISK_ASSESSMENT", "ALERT_REVIEW", "CASE_UPDATE", "WALLET_FREEZE"]
            for i in range(1000 - existing_audits):
                audit = m.AuditLog(
                    id=uuid.UUID(str(uuid.uuid4())),
                    action_type=random.choice(action_types),
                    entity_type=random.choice(["wallet", "transaction", "alert", "case"]),
                    user_identifier=f"admin_{random.randint(1, 10)}",
                    details={"action": random.choice(action_types), "risk_score": random.randint(0, 100)},
                    timestamp=datetime.now(timezone.utc) - timedelta(hours=i%168)
                )
                session.add(audit)

        session.commit()
        print(f"Compliance seed complete")
    except Exception as e:
        session.rollback()
        print(f"Seed failed: {e}")
    finally:
        session.close()


if __name__ == "__main__":
    seed()