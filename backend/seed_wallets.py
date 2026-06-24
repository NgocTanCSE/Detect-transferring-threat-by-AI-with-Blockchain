"""Seed core demo data: organizations, users, wallets, transactions, etc.
Idempotent – safe to re-run.
"""

import uuid
import random
import hashlib
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import models as m
from app.core.database import engine, Base


def _random_eth_address() -> str:
    return "0x" + "".join(random.choices("0123456789abcdef", k=40))


def _random_tx_hash() -> str:
    return "0x" + "".join(random.choices("0123456789abcdef", k=64))


def _random_float(low: float, high: float) -> float:
    return round(random.uniform(low, high), 2)


def _random_past_date(days_ago: int = 365) -> datetime:
    return datetime.now(timezone.utc) - timedelta(
        days=random.randint(0, days_ago),
        hours=random.randint(0, 23),
    )


def _uuid_str() -> str:
    return str(uuid.uuid4())


def seed():
    Base.metadata.create_all(bind=engine)
    session: Session = Session(bind=engine)
    try:
        _seed_organization(session)
        _seed_users(session)
        _seed_wallets(session)
        _seed_transactions(session)
        _seed_token_transfers(session)
        _seed_risk_assessments(session)
        _seed_blacklist(session)
        _seed_policy_rules(session)
        _seed_audit_logs(session)
        _seed_feedback_labels(session)
        _seed_ai_threat_logs(session)
        _seed_usage_logs(session)
        _seed_auth_sessions(session)
        session.commit()
        print("Core seed complete: 1 org, 5 users, 500 wallets, 1000 tx, 500 token_tx, 300 risk, 10 blacklist, 5 policies, 20 audit, 10 feedback, 20 threat, 50 usage, 5 sessions")
    except Exception as e:
        session.rollback()
        print(f"Seed failed: {e}")
        raise
    finally:
        session.close()


def _seed_organization(session: Session):
    existing = session.query(m.Organization).filter(m.Organization.slug == "blockchain-sentinel-demo").first()
    if existing:
        return
    org = m.Organization(
        id=_uuid_str(),
        name="Blockchain Sentinel Demo",
        slug="blockchain-sentinel-demo",
        contact_email="demo@blockchain-sentinel.io",
        api_key="demo_api_key_" + _uuid_str()[:8],
        is_active=True,
    )
    session.add(org)
    session.flush()
    print(f"  Organization: {org.id}")


def _seed_users(session: Session):
    org = session.query(m.Organization).filter(m.Organization.slug == "blockchain-sentinel-demo").first()
    if not org:
        raise RuntimeError("Organization not found; seed it first")
    existing_count = session.query(m.User).count()
    if existing_count >= 5:
        return

    password_hash = hashlib.sha256("demo123".encode()).hexdigest()
    users_data = [
        {"username": "admin", "email": "admin@sentinel.io", "role": "admin", "name": "Admin User"},
        {"username": "analyst1", "email": "analyst1@sentinel.io", "role": "analyst", "name": "Alice Analyst"},
        {"username": "analyst2", "email": "analyst2@sentinel.io", "role": "analyst", "name": "Bob Analyst"},
        {"username": "user1", "email": "user1@sentinel.io", "role": "user", "name": "Charlie User"},
        {"username": "user2", "email": "user2@sentinel.io", "role": "user", "name": "Diana User"},
    ]
    for u in users_data:
        existing = session.query(m.User).filter(m.User.username == u["username"]).first()
        if existing:
            continue
        user = m.User(
            id=_uuid_str(),
            username=u["username"],
            email=u["email"],
            password_hash=password_hash,
            role=u["role"],
            organization_id=org.id,
            wallet_address=_random_eth_address(),
            is_active=True,
            warning_count=random.randint(0, 3) if u["role"] == "user" else 0,
            last_login_at=_random_past_date(7),
        )
        session.add(user)
        session.flush()
        profile = m.UserProfile(
            id=_uuid_str(),
            user_id=user.id,
            full_name=u["name"],
            phone=f"+1-555-{random.randint(1000,9999)}",
            address=f"{random.randint(100,999)} Blockchain Blvd, San Francisco, CA",
            preferences={"email": True, "push": True, "sms": False},
        )
        session.add(profile)
    session.flush()
    print(f"  Users: seeded")


def _seed_wallets(session: Session):
    existing_count = session.query(m.Wallet).count()
    if existing_count >= 500:
        return
    org = session.query(m.Organization).filter(m.Organization.slug == "blockchain-sentinel-demo").first()
    chains = ["ethereum", "bsc"]
    entity_types = ["Unknown", "Exchange", "DeFi", "Private Wallet", "Miner", "Mixer"]
    statuses = ["active", "active", "active", "active", "suspended", "frozen", "under_review"]
    for i in range(500 - existing_count):
        wallet = m.Wallet(
            id=_uuid_str(),
            address=_random_eth_address(),
            label=f"Wallet_{i+1}",
            entity_type=random.choice(entity_types),
            organization_id=org.id,
            account_status=random.choice(statuses),
            risk_score=random.uniform(0, 100),
            risk_category=random.choices(
                [None, "money_laundering", "manipulation", "scam"],
                weights=[70, 10, 10, 10]
            )[0],
            total_transactions=random.randint(0, 500),
            total_value_sent=str(random.randint(0, 10**18)),
            total_value_received=str(random.randint(0, 10**18)),
            first_seen_at=_random_past_date(365),
            last_activity_at=_random_past_date(7),
            chain_id=random.choice(chains),
            flagged_at=None,
            flagged_by=None,
            notes=None,
        )
        if random.random() < 0.05 and wallet.risk_score > 70:
            wallet.flagged_at = _random_past_date(30)
            wallet.flagged_by = "admin"
            wallet.notes = "Flagged by AI demo"
        session.add(wallet)
    session.flush()
    print(f"  Wallets: {500 - existing_count} added")


def _seed_transactions(session: Session):
    existing_count = session.query(m.Transaction).count()
    if existing_count >= 1000:
        return
    wallets = session.query(m.Wallet).all()
    users = session.query(m.User).all()
    chains = ["ethereum", "bsc"]
    statuses_small = [0, 1, 1, 1, 1]
    case_statuses = ["PENDING", "PENDING", "PENDING", "VERIFIED", "FRAUD", "IGNORED"]
    for i in range(1000 - existing_count):
        from_wallet = random.choice(wallets)
        to_wallet = random.choice(wallets)
        while to_wallet.address == from_wallet.address and len(wallets) > 1:
            to_wallet = random.choice(wallets)
        tx = m.Transaction(
            id=_uuid_str(),
            tx_hash=_random_tx_hash(),
            from_address=from_wallet.address,
            to_address=to_wallet.address,
            value=str(random.randint(1, 10**18)),
            block_number=random.randint(10000000, 20000000),
            timestamp=_random_past_date(180),
            gas_price=str(random.randint(1, 500)),
            gas_used=random.randint(21000, 300000),
            input_data="0x" if random.random() < 0.8 else _random_tx_hash(),
            status=random.choice(statuses_small),
            normalized_risk_score=round(random.uniform(0, 1), 2) if random.random() < 0.3 else None,
            case_status=random.choice(case_statuses),
            assigned_to=random.choice(users).id if random.random() < 0.3 else None,
            is_flagged=random.random() < 0.1,
            flag_reason=random.choice([None, "high_risk", "blacklist_match", "suspicious_pattern"]),
            organization_id=from_wallet.organization_id,
            chain_id=random.choice(chains),
        )
        session.add(tx)
    session.flush()
    print(f"  Transactions: {1000 - existing_count} added")


def _seed_token_transfers(session: Session):
    existing_count = session.query(m.TokenTransfer).count()
    if existing_count >= 500:
        return
    txs = session.query(m.Transaction).all()
    if not txs:
        return
    orgs = session.query(m.Organization).all()
    symbols = ["ETH", "USDT", "USDC", "DAI", "WBTC", "LINK", "UNI", "AAVE", "MATIC", "BNB"]
    chains = ["ethereum", "bsc"]
    for i in range(500 - existing_count):
        tx = random.choice(txs)
        token = m.TokenTransfer(
            id=_uuid_str(),
            transaction_hash=tx.tx_hash,
            block_number=tx.block_number,
            log_index=random.randint(0, 100),
            token_address=_random_eth_address(),
            token_symbol=random.choice(symbols),
            token_name=f"{random.choice(symbols)} Token",
            token_decimals=18,
            from_address=tx.from_address,
            to_address=tx.to_address,
            value=str(random.randint(1, 10**16)),
            value_decimal=round(random.uniform(0.001, 10000), 18),
            transfer_type=random.choice(["ERC20", "ERC721"]),
            organization_id=random.choice(orgs).id if orgs else None,
            timestamp=tx.timestamp,
        )
        session.add(token)
    session.flush()
    print(f"  TokenTransfers: {500 - existing_count} added")


def _seed_risk_assessments(session: Session):
    existing_count = session.query(m.RiskAssessment).count()
    if existing_count >= 300:
        return
    wallets = session.query(m.Wallet).filter(m.Wallet.risk_score > 0).all()
    if not wallets:
        return
    levels = ["LOW", "LOW", "MEDIUM", "HIGH", "CRITICAL"]
    for i in range(min(300 - existing_count, len(wallets))):
        wallet = random.choice(wallets)
        score = wallet.risk_score
        ra = m.RiskAssessment(
            id=_uuid_str(),
            wallet_id=wallet.id,
            score=score,
            risk_level=random.choices(levels, weights=[30, 30, 20, 15, 5], k=1)[0],
            details={
                "structuring": score > 50,
                "mixer_usage": score > 70,
                "chain_hopping": score > 40,
                "agent": "multi_agent_v1",
            },
            model_version="v1.0",
            assessed_at=_random_past_date(30),
        )
        session.add(ra)
    session.flush()
    print(f"  RiskAssessments: {min(300 - existing_count, len(wallets))} added")


def _seed_blacklist(session: Session):
    existing_count = session.query(m.Blacklist).count()
    if existing_count >= 10:
        return
    categories = ["sanctioned", "hack", "phishing", "scam", "mixer"]
    severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    for i in range(10 - existing_count):
        bl = m.Blacklist(
            id=_uuid_str(),
            address=_random_eth_address(),
            category=random.choice(categories),
            source="https://etherscan.io/",
            description=f"Blacklisted for {random.choice(categories)} activity",
            severity=random.choices(severities, weights=[20, 30, 40, 10], k=1)[0],
            is_active=True,
            reported_at=_random_past_date(90),
            verified_at=_random_past_date(30),
            expires_at=None if random.random() < 0.8 else _random_past_date(-30),
        )
        session.add(bl)
    session.flush()
    print(f"  Blacklist: {10 - existing_count} added")


def _seed_policy_rules(session: Session):
    existing_count = session.query(m.PolicyRule).count()
    if existing_count >= 5:
        return
    rules = [
        {"name": "Block High-Risk Transfers", "min_risk": 80.0, "desc": "Auto-block any transfer with risk score >= 80", "block_blacklisted": True, "block_suspended": True, "priority": 100},
        {"name": "Block Blacklist Wallets", "min_risk": 0.0, "desc": "Block any transfer involving a blacklisted address", "block_blacklisted": True, "block_suspended": False, "priority": 200},
        {"name": "Suspend 3-Warning Violators", "min_risk": 50.0, "desc": "Suspend users who ignored 3 risk warnings", "block_blacklisted": False, "block_suspended": True, "priority": 150},
        {"name": "Flag Large Transfers", "min_risk": 60.0, "desc": "Flag transfers > 100 ETH for manual review", "block_blacklisted": False, "block_suspended": False, "priority": 50},
        {"name": "Critical Alert Response", "min_risk": 90.0, "desc": "Immediate block and notify admin for critical alerts", "block_blacklisted": True, "block_suspended": True, "priority": 10},
    ]
    # assign random user as created_by
    users = session.query(m.User).all()
    for rule in rules:
        existing = session.query(m.PolicyRule).filter(m.PolicyRule.rule_name == rule["name"]).first()
        if existing:
            continue
        pr = m.PolicyRule(
            id=_uuid_str(),
            rule_name=rule["name"],
            description=rule["desc"],
            min_risk_score=rule["min_risk"],
            block_blacklisted=rule["block_blacklisted"],
            block_suspended=rule["block_suspended"],
            notify_on_block=True,
            priority=rule["priority"],
            is_active=True,
            created_by=random.choice(users).id if users else None,
        )
        session.add(pr)
    session.flush()
    print(f"  PolicyRules: seeded")


def _seed_audit_logs(session: Session):
    existing_count = session.query(m.AuditLog).count()
    if existing_count >= 20:
        return
    actions = ["user.login", "user.register", "alert.acknowledge", "transfer.block", "policy.update", "case.create"]
    entities = ["User", "Wallet", "Transaction", "Alert", "PolicyRule", "Case"]
    for i in range(20 - existing_count):
        log = m.AuditLog(
            id=_uuid_str(),
            action_type=random.choice(actions),
            entity_type=random.choice(entities),
            entity_id=_uuid_str(),
            user_identifier=f"user_{random.randint(1,5)}@sentinel.io",
            ip_address=f"{random.randint(1,255)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,255)}",
            details={"source": "seed", "seed_version": "v1.0"},
            timestamp=_random_past_date(30),
        )
        session.add(log)
    session.flush()
    print(f"  AuditLogs: {20 - existing_count} added")


def _seed_feedback_labels(session: Session):
    existing_count = session.query(m.FeedbackLabel).count()
    if existing_count >= 10:
        return
    wallets = session.query(m.Wallet).all()
    if not wallets:
        return
    labels = ["fraud", "safe", "uncertain"]
    categories = ["money_laundering", "scam", "wash_trading", None]
    for i in range(10 - existing_count):
        wallet = random.choice(wallets)
        fl = m.FeedbackLabel(
            id=_uuid_str(),
            wallet_address=wallet.address,
            ai_score=wallet.risk_score,
            ai_risk_level=random.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
            ai_model_version="v1.0",
            admin_label=random.choices(labels, weights=[30, 60, 10], k=1)[0],
            admin_category=random.choice(categories),
            admin_notes="Demo feedback",
            admin_username="admin",
            used_for_training=random.random() < 0.3,
            training_batch_id=f"batch_{random.randint(1,5)}" if random.random() < 0.5 else None,
        )
        session.add(fl)
    session.flush()
    print(f"  FeedbackLabels: {10 - existing_count} added")


def _seed_ai_threat_logs(session: Session):
    existing_count = session.query(m.AIThreatLog).count()
    if existing_count >= 20:
        return
    wallets = session.query(m.Wallet).all()
    if not wallets:
        return
    threat_types = ["CYCLE", "TRACE_BACK", "STRUCTURING", "MIXER", "CHAIN_HOP"]
    for i in range(20 - existing_count):
        wallet = random.choice(wallets)
        tl = m.AIThreatLog(
            id=_uuid_str(),
            wallet_address=wallet.address,
            threat_type=random.choice(threat_types),
            risk_score=wallet.risk_score,
            details={
                "detected_by": random.choice(["money_laundering_agent", "wash_trading_agent", "scam_agent"]),
                "confidence": round(random.uniform(0.5, 1.0), 2),
                "transactions_analyzed": random.randint(10, 200),
            },
            detected_at=_random_past_date(30),
        )
        session.add(tl)
    session.flush()
    print(f"  AIThreatLogs: {20 - existing_count} added")


def _seed_usage_logs(session: Session):
    existing_count = session.query(m.UsageLog).count()
    if existing_count >= 50:
        return
    users = session.query(m.User).all()
    orgs = session.query(m.Organization).all()
    if not users or not orgs:
        return
    endpoints = ["/auth/login", "/wallets/balance", "/transfers/create", "/alerts/list", "/dashboard", "/assistant/chat"]
    methods = ["GET", "POST", "PUT", "DELETE"]
    for i in range(50 - existing_count):
        ul = m.UsageLog(
            id=_uuid_str(),
            organization_id=random.choice(orgs).id,
            user_id=random.choice(users).id,
            endpoint=random.choice(endpoints),
            method=random.choice(methods),
            status_code=random.choices([200, 200, 200, 201, 400, 401, 500], weights=[60, 20, 5, 5, 5, 3, 2], k=1)[0],
            response_time_ms=random.randint(50, 3000),
            ip_address=f"{random.randint(1,255)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,255)}",
            user_agent="SeedScript/1.0",
            timestamp=_random_past_date(30),
        )
        session.add(ul)
    session.flush()
    print(f"  UsageLogs: {50 - existing_count} added")


def _seed_auth_sessions(session: Session):
    existing_count = session.query(m.AuthSession).count()
    if existing_count >= 5:
        return
    users = session.query(m.User).all()
    if not users:
        return
    for user in users[:5]:
        existing = session.query(m.AuthSession).filter(m.AuthSession.user_id == user.id).first()
        if existing:
            continue
        token_raw = f"seed_token_{user.username}_{uuid.uuid4()}"
        token_hash = hashlib.sha256(token_raw.encode()).hexdigest()
        asession = m.AuthSession(
            id=_uuid_str(),
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
        session.add(asession)
    session.flush()
    print(f"  AuthSessions: seeded")


if __name__ == "__main__":
    seed()
