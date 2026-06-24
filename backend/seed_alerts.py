"""Seed alert-related demo data: alerts, blocked transfers, user warnings,
notification events. Must be run after seed_wallets.py.
Idempotent – safe to re-run.
"""

import uuid
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import models as m
from app.core.database import engine, Base


def _uuid_str() -> str:
    return str(uuid.uuid4())


def _random_eth_address() -> str:
    return "0x" + "".join(random.choices("0123456789abcdef", k=40))


def _random_past_date(days_ago: int = 365) -> datetime:
    return datetime.now(timezone.utc) - timedelta(
        days=random.randint(0, days_ago),
        hours=random.randint(0, 23),
    )


def seed():
    Base.metadata.create_all(bind=engine)
    session: Session = Session(bind=engine)
    try:
        _seed_alerts(session)
        _seed_blocked_transfers(session)
        _seed_user_warnings(session)
        _seed_notification_events(session)
        session.commit()
        print("Alert seed complete: 200 alerts, 50 blocked transfers, 20 warnings, 20 notifications")
    except Exception as e:
        session.rollback()
        print(f"Alert seed failed: {e}")
        raise
    finally:
        session.close()


def _seed_alerts(session: Session):
    existing_count = session.query(m.Alert).count()
    if existing_count >= 200:
        return
    wallets = session.query(m.Wallet).all()
    users = session.query(m.User).all()
    orgs = session.query(m.Organization).all()
    if not wallets:
        print("  Wallets empty; skipping alerts")
        return

    alert_types = [
        "high_risk_transfer", "blacklist_match", "structuring",
        "mixer_interaction", "chain_hop", "rapid_flow", "phishing",
        "suspicious_contract", "wash_trading", "unusual_volume",
    ]
    severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    chains = ["ethereum", "bsc"]

    for i in range(200 - existing_count):
        wallet = random.choice(wallets)
        severity = random.choices(severities, weights=[30, 35, 25, 10], k=1)[0]
        alert = m.Alert(
            id=_uuid_str(),
            wallet_address=wallet.address,
            alert_type=random.choice(alert_types),
            severity=severity,
            message=f"[{severity}] {random.choice(alert_types).replace('_',' ').title()} detected on {wallet.address[:10]}...",
            risk_score=wallet.risk_score,
            meta={
                "chain": random.choice(chains),
                "detected_by": "multi_agent_v1",
                "tx_count": wallet.total_transactions,
            },
            chain_id=random.choice(chains),
            detected_at=_random_past_date(30),
            acknowledged=random.random() < 0.4,
            acknowledged_at=None,
            acknowledged_by=random.choice([None, None, "admin", "analyst1"]),
            organization_id=random.choice(orgs).id if orgs else None,
        )
        if alert.acknowledged and random.random() < 0.5:
            alert.acknowledged_at = _random_past_date(5)
            alert.acknowledged_by = random.choice(users).username if users else "admin"
        session.add(alert)
    session.flush()
    print(f"  Alerts: {200 - existing_count} added")


def _seed_blocked_transfers(session: Session):
    existing_count = session.query(m.BlockedTransfer).count()
    if existing_count >= 50:
        return
    wallets = session.query(m.Wallet).all()
    users = session.query(m.User).all()
    orgs = session.query(m.Organization).all()
    if not wallets:
        return

    reasons = [
        "risk_score_exceeded", "blacklist_address", "suspended_account",
        "warning_limit_reached", "policy_rule_blocked",
    ]
    chains = ["ethereum", "bsc"]

    for i in range(50 - existing_count):
        sender = random.choice(wallets)
        receiver = random.choice(wallets)
        while receiver.address == sender.address and len(wallets) > 1:
            receiver = random.choice(wallets)
        bt = m.BlockedTransfer(
            id=_uuid_str(),
            sender_address=sender.address,
            receiver_address=receiver.address,
            amount=str(random.randint(1, 10**16)),
            risk_score=sender.risk_score,
            block_reason=random.choice(reasons),
            chain_id=random.choice(chains),
            user_warning_count=random.randint(0, 5),
            sender_user_id=random.choice(users).id if users and random.random() < 0.7 else None,
            organization_id=random.choice(orgs).id if orgs else None,
            blocked_at=_random_past_date(14),
        )
        session.add(bt)
    session.flush()
    print(f"  BlockedTransfers: {50 - existing_count} added")


def _seed_user_warnings(session: Session):
    existing_count = session.query(m.UserWarning).count()
    if existing_count >= 20:
        return
    users = session.query(m.User).all()
    wallets = session.query(m.Wallet).all()
    if not users or not wallets:
        return

    warning_types = [
        "high_risk_recipient", "blacklist_interaction",
        "suspicious_pattern", "rapid_transfer",
    ]
    actions = [None, "ignored", "cancelled", "reported"]

    for i in range(20 - existing_count):
        user = random.choice(users)
        uw = m.UserWarning(
            id=_uuid_str(),
            user_id=user.id,
            wallet_address=user.wallet_address or wallets[0].address,
            target_address=random.choice(wallets).address,
            warning_type=random.choice(warning_types),
            risk_score=random.uniform(30, 100),
            user_action=random.choices(actions, weights=[40, 30, 20, 10], k=1)[0],
            warning_number=random.randint(1, 5),
            created_at=_random_past_date(14),
        )
        session.add(uw)
    session.flush()
    print(f"  UserWarnings: {20 - existing_count} added")


def _seed_notification_events(session: Session):
    existing_count = session.query(m.NotificationEvent).count()
    if existing_count >= 20:
        return
    channels = ["slack", "telegram", "email", "webhook"]
    severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    statuses = ["queued", "sent", "sent", "failed"]

    for i in range(20 - existing_count):
        ne = m.NotificationEvent(
            id=_uuid_str(),
            channel=random.choice(channels),
            recipient=f"admin+{uuid.uuid4().hex[:4]}@sentinel.io",
            severity=random.choice(severities),
            message=f"[{random.choice(severities)}] Alert notification for demo",
            status=random.choice(statuses),
            meta={"source": "seed_alerts", "event_type": "demo_alert"},
            sent_at=datetime.now(timezone.utc) if random.random() < 0.7 else None,
        )
        session.add(ne)
    session.flush()
    print(f"  NotificationEvents: {20 - existing_count} added")


if __name__ == "__main__":
    seed()
