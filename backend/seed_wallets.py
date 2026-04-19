"""
Seed script to populate a richer local demo dataset.

This keeps the local UI populated with users, wallets, transactions,
policy rules, model registry rows, alerts, blocked transfers, and other
operational tables.

Usage: python seed_wallets.py
"""

from __future__ import annotations

import os
import random
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal

from app.core.config import DATABASE_URL
from app.core.database import Base, SessionLocal, engine
from app.models.models import (
    Alert,
    AuditLog,
    Blacklist,
    BlockedTransfer,
    FeatureStoreConfig,
    ModelRegistry,
    NodeEndpoint,
    NotificationEvent,
    PipelineMetric,
    PolicyRule,
    Transaction,
    TransactionCase,
    User,
    Wallet,
)


DEFAULT_USER_COUNT = int(os.getenv("LOCAL_DEMO_USER_COUNT", "1000"))
DEFAULT_TX_PER_USER = int(os.getenv("LOCAL_DEMO_TX_PER_USER", "2"))
DEFAULT_ALERTS = int(os.getenv("LOCAL_DEMO_ALERT_COUNT", "120"))
DEFAULT_BLOCKED = int(os.getenv("LOCAL_DEMO_BLOCKED_COUNT", "40"))
DEFAULT_CASES = int(os.getenv("LOCAL_DEMO_CASE_COUNT", "80"))
RANDOM_SEED = int(os.getenv("LOCAL_DEMO_SEED", "1337"))

ROOT_ADDRESS = "0x0000000000000000000000000000000000000000"


@dataclass(frozen=True)
class SeedUser:
    user: User
    wallet: Wallet


def _eth(amount: float) -> Decimal:
    return Decimal(str(amount)) * Decimal("1000000000000000000")


def _make_address(rng: random.Random, index: int) -> str:
    return f"0x{index:040x}" if index < 16 else "0x" + "".join(rng.choice("0123456789abcdef") for _ in range(40))


def _make_uuid(prefix: str, index: int) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_DNS, f"blockchain-ai::{prefix}::{index}")


def _pick(sequence, index: int):
    return sequence[index % len(sequence)]


def _role_for_index(index: int) -> str:
    if index == 0:
        return "admin"
    if index % 17 == 0:
        return "analyst"
    return "user"


def _risk_score_for_index(index: int, rng: random.Random) -> float:
    base = 8.0 + (index % 100) * 0.55
    jitter = rng.uniform(-6.0, 8.0)
    return max(0.5, min(99.9, round(base + jitter, 2)))


def _status_for_score(score: float) -> tuple[str, str | None]:
    if score >= 85:
        return "frozen", "scam"
    if score >= 65:
        return "under_review", "manipulation"
    if score >= 45:
        return "active", "suspicious_activity"
    return "active", None


def _build_seed_users(user_count: int, rng: random.Random, now: datetime) -> list[SeedUser]:
    canonical_wallets = [
        (
            "Alice User Account",
            "0x742d35cc6634c0532925a3b844bc9e7595f2bd08",
            15.5,
            None,
            5,
            _eth(1),
            _eth(11),
        ),
        (
            "Bob Suspected Account",
            "0x8ba1f109551bd432803012645ac136ddd64dba72",
            62.3,
            "manipulation",
            12,
            _eth(3.5),
            _eth(5.2),
        ),
        (
            "Charlie Trading Account",
            "0x9f8c5e6f5e6e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e",
            28.7,
            None,
            22,
            _eth(8.5),
            _eth(15),
        ),
        (
            "Scam Wallet",
            "0xdead1000000000000000000000000000000dead",
            99.8,
            "scam",
            145,
            _eth(95),
            _eth(2),
        ),
    ]

    seed_rows: list[SeedUser] = []

    for index in range(user_count):
        if index < len(canonical_wallets):
            label, address, risk_score, risk_category, total_transactions, total_sent, total_received = canonical_wallets[index]
        else:
            address = _make_address(rng, index)
            label = f"Demo Wallet {index:05d}"
            risk_score = _risk_score_for_index(index, rng)
            risk_category = _status_for_score(risk_score)[1]
            total_transactions = 10 + (index % 40)
            total_sent = _eth(rng.uniform(0.5, 25.0))
            total_received = total_sent + _eth(rng.uniform(0.5, 40.0))

        account_status, inferred_category = _status_for_score(risk_score)
        if risk_category is None:
            risk_category = inferred_category

        user = User(
            id=_make_uuid("user", index),
            username=f"demo_user_{index:05d}",
            email=f"demo_user_{index:05d}@local.test",
            password_hash="$2b$12$demo.seed.hash.placeholder",
            role=_role_for_index(index),
            wallet_address=address,
            is_active=True,
            warning_count=0 if risk_score < 65 else 2,
            last_login_at=now - timedelta(days=index % 14),
            created_at=now - timedelta(days=180 - (index % 60)),
            updated_at=now,
        )

        wallet = Wallet(
            id=_make_uuid("wallet", index),
            address=address,
            label=label,
            entity_type="User",
            account_status=account_status,
            risk_score=risk_score,
            risk_category=risk_category,
            total_transactions=total_transactions,
            total_value_sent=total_sent,
            total_value_received=total_received,
            first_seen_at=now - timedelta(days=120 - (index % 90)),
            last_activity_at=now - timedelta(hours=index % 36),
            flagged_at=now - timedelta(days=7) if risk_score >= 85 else None,
            flagged_by="seed_bot" if risk_score >= 85 else None,
            notes="Seeded demo wallet" if index >= len(canonical_wallets) else f"{label} seeded for local demo",
        )

        seed_rows.append(SeedUser(user=user, wallet=wallet))

    return seed_rows


def _validate_seed_pairs(seed_rows: list[SeedUser]) -> None:
    for seed in seed_rows:
        if seed.user.wallet_address != seed.wallet.address:
            raise ValueError(f"Seed mismatch for user {seed.user.username}: {seed.user.wallet_address} != {seed.wallet.address}")


def _attach_seed_note(seed_rows: list[SeedUser]) -> None:
    for seed in seed_rows:
        owner_label = seed.user.username.replace("demo_user_", "user_")
        seed.wallet.notes = (seed.wallet.notes or "") + f" | owner={owner_label}"


def _build_transactions(seed_rows: list[SeedUser], tx_per_user: int, rng: random.Random, now: datetime) -> list[Transaction]:
    transactions: list[Transaction] = []
    wallets = [seed.wallet.address for seed in seed_rows]

    for index, seed in enumerate(seed_rows):
        source = seed.wallet.address
        for tx_index in range(tx_per_user):
            target = _pick(wallets, index + tx_index + 1)
            if target == source:
                target = _pick(wallets, index + tx_index + 7)

            tx_hash = f"0x{uuid.uuid5(uuid.NAMESPACE_DNS, f'tx::{source}::{tx_index}').hex}{uuid.uuid5(uuid.NAMESPACE_DNS, f'tx::{index}::{tx_index}').hex[:32]}"
            risk_score = round(min(0.99, max(0.03, seed.wallet.risk_score / 100)), 2)
            value = _eth(rng.uniform(0.05, 6.0))
            transactions.append(
                Transaction(
                    id=_make_uuid("tx", index * tx_per_user + tx_index),
                    tx_hash=tx_hash[:66],
                    from_address=source,
                    to_address=target,
                    value=value,
                    block_number=18_000_000 + index * 13 + tx_index,
                    timestamp=now - timedelta(days=index % 45, minutes=tx_index * 3),
                    gas_price=_eth(0.00000002),
                    gas_used=21_000,
                    input_data="0x",
                    status=1 if seed.wallet.risk_score < 88 else 0,
                    normalized_risk_score=risk_score,
                    case_status="PENDING" if seed.wallet.risk_score < 65 else "ESCALATED",
                    assigned_to=seed.user.id if index % 11 == 0 else None,
                    is_flagged=seed.wallet.risk_score >= 65,
                    flag_reason=seed.wallet.risk_category,
                )
            )

    return transactions


def seed_wallets() -> None:
    """Seed the local database with a richer demo dataset."""
    db_backend = "sqlite" if DATABASE_URL.startswith("sqlite") else "postgres"
    print(f"Using database backend: {db_backend}")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    now = datetime.utcnow()
    rng = random.Random(RANDOM_SEED)

    try:
        existing_wallets = {address for (address,) in db.query(Wallet.address).all()}
        existing_users = {username for (username,) in db.query(User.username).all()}
        existing_tx_hashes = {tx_hash for (tx_hash,) in db.query(Transaction.tx_hash).all()}
        existing_alert_ids = {alert_id for (alert_id,) in db.query(Alert.id).all()}
        existing_blocked_ids = {blocked_id for (blocked_id,) in db.query(BlockedTransfer.id).all()}
        existing_case_ids = {case_id for (case_id,) in db.query(TransactionCase.id).all()}
        existing_audit_ids = {audit_id for (audit_id,) in db.query(AuditLog.id).all()}
        existing_notification_ids = {notification_id for (notification_id,) in db.query(NotificationEvent.id).all()}
        existing_feature_ids = {feature_id for (feature_id,) in db.query(FeatureStoreConfig.id).all()}
        existing_node_ids = {node_id for (node_id,) in db.query(NodeEndpoint.id).all()}
        existing_policy_rules = {rule_name for (rule_name,) in db.query(PolicyRule.rule_name).all()}
        existing_models = {(model_name, version) for model_name, version in db.query(ModelRegistry.model_name, ModelRegistry.version).all()}
        existing_pipeline_ids = {metric_id for (metric_id,) in db.query(PipelineMetric.id).all()}

        seed_rows = _build_seed_users(DEFAULT_USER_COUNT, rng, now)
        _validate_seed_pairs(seed_rows)
        _attach_seed_note(seed_rows)
        users_to_add = [seed.user for seed in seed_rows if seed.user.username not in existing_users]
        wallets_to_add = [seed.wallet for seed in seed_rows if seed.wallet.address not in existing_wallets]
        transactions_to_add = [tx for tx in _build_transactions(seed_rows, DEFAULT_TX_PER_USER, rng, now) if tx.tx_hash not in existing_tx_hashes]

        policy_rules = [
            PolicyRule(
                id=_make_uuid("policy", 1),
                rule_name="Block High Risk Transfers",
                description="Block transfers above the configured risk threshold.",
                min_risk_score=80.0,
                block_blacklisted=True,
                block_suspended=True,
                notify_on_block=True,
                priority=10,
                is_active=True,
                created_by=users_to_add[0].id if users_to_add else None,
                created_at=now - timedelta(days=10),
                updated_at=now,
            ),
            PolicyRule(
                id=_make_uuid("policy", 2),
                rule_name="Monitor Suspicious Velocity",
                description="Escalate wallets that receive too many transfers in a short window.",
                min_risk_score=60.0,
                block_blacklisted=False,
                block_suspended=True,
                notify_on_block=True,
                priority=20,
                is_active=True,
                created_by=users_to_add[0].id if users_to_add else None,
                created_at=now - timedelta(days=9),
                updated_at=now,
            ),
            PolicyRule(
                id=_make_uuid("policy", 3),
                rule_name="Require Manual Review for New Wallets",
                description="Keep freshly created wallets in review until they accumulate enough history.",
                min_risk_score=45.0,
                block_blacklisted=False,
                block_suspended=False,
                notify_on_block=True,
                priority=30,
                is_active=True,
                created_by=users_to_add[0].id if users_to_add else None,
                created_at=now - timedelta(days=8),
                updated_at=now,
            ),
        ]
        policy_rules = [rule for rule in policy_rules if rule.rule_name not in existing_policy_rules]

        model_registry = [
            ModelRegistry(
                id=_make_uuid("model", 1),
                model_name="risk_detector",
                version="v1.4.0",
                artifact_uri="s3://local-demo/models/risk_detector/v1.4.0.pkl",
                framework="pkl",
                is_active=True,
                promoted_by=users_to_add[0].id if users_to_add else None,
                promoted_at=now - timedelta(days=2),
                created_at=now - timedelta(days=20),
            ),
            ModelRegistry(
                id=_make_uuid("model", 2),
                model_name="transaction_graph_model",
                version="v2.1.0",
                artifact_uri="s3://local-demo/models/transaction_graph_model/v2.1.0.onnx",
                framework="onnx",
                is_active=False,
                promoted_by=users_to_add[1].id if len(users_to_add) > 1 else None,
                promoted_at=now - timedelta(days=5),
                created_at=now - timedelta(days=35),
            ),
            ModelRegistry(
                id=_make_uuid("model", 3),
                model_name="wallet_clustering_model",
                version="v0.9.1",
                artifact_uri="s3://local-demo/models/wallet_clustering_model/v0.9.1.pt",
                framework="pt",
                is_active=False,
                promoted_by=users_to_add[1].id if len(users_to_add) > 1 else None,
                promoted_at=now - timedelta(days=9),
                created_at=now - timedelta(days=50),
            ),
        ]
        model_registry = [model for model in model_registry if (model.model_name, model.version) not in existing_models]

        alerts: list[Alert] = []
        blocked_transfers: list[BlockedTransfer] = []
        transaction_cases: list[TransactionCase] = []
        audit_logs: list[AuditLog] = []
        notifications: list[NotificationEvent] = []
        feature_configs: list[FeatureStoreConfig] = []
        node_endpoints: list[NodeEndpoint] = []
        pipeline_metrics: list[PipelineMetric] = []

        risky_wallets = [seed for seed in seed_rows if seed.wallet.risk_score >= 60]
        for index, seed in enumerate(risky_wallets[:DEFAULT_ALERTS]):
            alerts.append(
                Alert(
                    id=_make_uuid("alert", index),
                    wallet_address=seed.wallet.address,
                    alert_type="Risk Spike",
                    severity="CRITICAL" if seed.wallet.risk_score >= 85 else "HIGH",
                    message=f"Wallet {seed.wallet.label} exceeded the local risk threshold.",
                    risk_score=seed.wallet.risk_score,
                    meta={"label": seed.wallet.label, "source": "seed"},
                    detected_at=now - timedelta(hours=index % 72),
                    acknowledged=index % 4 == 0,
                    acknowledged_at=now - timedelta(hours=index % 12) if index % 4 == 0 else None,
                    acknowledged_by=users_to_add[0].username if users_to_add else None,
                )
            )

            alerts = [alert for alert in alerts if alert.id not in existing_alert_ids]

        for index, seed in enumerate(risky_wallets[:DEFAULT_BLOCKED]):
            sender_user = seed.user
            receiver = _pick(seed_rows, index + 7).wallet.address
            blocked_transfers.append(
                BlockedTransfer(
                    id=_make_uuid("blocked", index),
                    sender_address=seed.wallet.address,
                    receiver_address=receiver,
                    amount=_eth(0.75 + (index % 8) * 0.5),
                    risk_score=seed.wallet.risk_score,
                    block_reason="High risk threshold exceeded",
                    user_warning_count=seed.user.warning_count,
                    sender_user_id=sender_user.id,
                    blocked_at=now - timedelta(days=index % 21, minutes=index * 5),
                )
            )

            blocked_transfers = [blocked for blocked in blocked_transfers if blocked.id not in existing_blocked_ids]

        for index, tx in enumerate(transactions_to_add[:DEFAULT_CASES]):
            assigned_user = users_to_add[index % len(users_to_add)].id if users_to_add else None
            transaction_cases.append(
                TransactionCase(
                    id=_make_uuid("case", index),
                    tx_hash=tx.tx_hash,
                    analyst_id=assigned_user,
                    action=_pick(["ASSIGN", "CONFIRM_FRAUD", "DISMISS", "ESCALATE"], index),
                    state=_pick(["PENDING", "VERIFIED", "FRAUD", "IGNORED"], index),
                    note=f"Seeded case for transaction {tx.tx_hash[:12]}.",
                    created_at=now - timedelta(days=index % 18),
                    updated_at=now,
                )
            )

            transaction_cases = [case for case in transaction_cases if case.id not in existing_case_ids]

        for index, seed in enumerate(seed_rows[:50]):
            audit_logs.append(
                AuditLog(
                    id=_make_uuid("audit", index),
                    action_type=_pick(["CREATE", "UPDATE", "BLOCK", "REVIEW", "EXPORT"], index),
                    entity_type="wallet",
                    entity_id=seed.wallet.id,
                    user_identifier=seed.user.username,
                    ip_address=f"10.0.{index % 16}.{(index % 200) + 1}",
                    details={"wallet": seed.wallet.address, "risk_score": seed.wallet.risk_score},
                    timestamp=now - timedelta(hours=index * 2),
                )
            )

            audit_logs = [audit for audit in audit_logs if audit.id not in existing_audit_ids]

        for index, seed in enumerate(seed_rows[:60]):
            notifications.append(
                NotificationEvent(
                    id=_make_uuid("notification", index),
                    channel=_pick(["slack", "email", "webhook", "telegram"], index),
                    recipient=f"ops-{index:02d}@local.test",
                    severity=_pick(["LOW", "MEDIUM", "HIGH", "CRITICAL"], index),
                    message=f"Notification for {seed.wallet.label} ({seed.wallet.address[:10]}...).",
                    status=_pick(["queued", "sent", "failed"], index),
                    meta={"wallet": seed.wallet.address, "source": "seed"},
                    created_at=now - timedelta(minutes=index * 12),
                    sent_at=now - timedelta(minutes=index * 12 - 2) if index % 3 == 0 else None,
                )
            )

            notifications = [notification for notification in notifications if notification.id not in existing_notification_ids]

        for index in range(12):
            feature_configs.append(
                FeatureStoreConfig(
                    id=_make_uuid("feature", index),
                    feature_key=f"feature_{index:02d}",
                    enabled=index % 4 != 0,
                    expression=f"risk_score >= {40 + index}",
                    owner_user_id=users_to_add[index % len(users_to_add)].id if users_to_add else None,
                    created_at=now - timedelta(days=20 - index),
                    updated_at=now,
                )
            )

            feature_configs = [feature for feature in feature_configs if feature.id not in existing_feature_ids]

        for index in range(8):
            status = _pick(["healthy", "healthy", "healthy", "degraded", "down"], index)
            node_endpoints.append(
                NodeEndpoint(
                    id=_make_uuid("node", index),
                    provider_name=_pick(["Alchemy", "Infura", "QuickNode", "Ankr"], index),
                    chain=_pick(["ethereum", "polygon", "arbitrum"], index),
                    endpoint_url=f"https://node{index}.local-demo.invalid/rpc",
                    protocol=_pick(["http", "websocket"], index),
                    priority=10 + index,
                    is_active=True,
                    health_status=status,
                    last_error=None if status != "down" else "Timeout while contacting upstream node",
                    last_checked_at=now - timedelta(minutes=index * 15),
                    created_at=now - timedelta(days=25 - index),
                    updated_at=now,
                )
            )

            node_endpoints = [node for node in node_endpoints if node.id not in existing_node_ids]

        for index in range(90):
            pipeline_metrics.append(
                PipelineMetric(
                    id=index + 1,
                    chain=_pick(["ethereum", "polygon", "arbitrum"], index),
                    block_number=18_000_000 + index * 11,
                    throughput_tps=Decimal(str(round(42.5 + (index % 7) * 3.1, 2))),
                    ingestion_latency_ms=180 + (index % 9) * 15,
                    decode_latency_ms=220 + (index % 11) * 18,
                    inserted_at=now - timedelta(minutes=index * 10),
                )
            )

        pipeline_metrics = [metric for metric in pipeline_metrics if metric.id not in existing_pipeline_ids]

        db.add_all(users_to_add)
        db.add_all(wallets_to_add)
        db.add_all(transactions_to_add)
        db.add_all(policy_rules)
        db.add_all(model_registry)
        db.add_all(alerts)
        db.add_all(blocked_transfers)
        db.add_all(transaction_cases)
        db.add_all(audit_logs)
        db.add_all(notifications)
        db.add_all(feature_configs)
        db.add_all(node_endpoints)
        db.add_all(pipeline_metrics)

        existing_blacklist = db.query(Blacklist).filter(Blacklist.address == "0xdead1000000000000000000000000000000dead").first()
        if not existing_blacklist:
            db.add(
                Blacklist(
                    id=_make_uuid("blacklist", 1),
                    address="0xdead1000000000000000000000000000000dead",
                    category="scam",
                    source="Internal Detection",
                    description="Seeded scam wallet used to keep the local dashboard populated.",
                    severity="CRITICAL",
                    is_active=True,
                    reported_at=now,
                )
            )

        db.commit()

        print("\n" + "=" * 60)
        print("LOCAL DEMO SEED SUMMARY")
        print("=" * 60)
        print(f"Users added: {len(users_to_add)}")
        print(f"Wallets added: {len(wallets_to_add)}")
        print(f"Transactions added: {len(transactions_to_add)}")
        print(f"Policy rules added: {len(policy_rules)}")
        print(f"Model registry rows added: {len(model_registry)}")
        print(f"Alerts added: {len(alerts)}")
        print(f"Blocked transfers added: {len(blocked_transfers)}")
        print(f"Case records added: {len(transaction_cases)}")
        print(f"Notifications added: {len(notifications)}")
        print(f"Feature configs added: {len(feature_configs)}")
        print(f"Node endpoints added: {len(node_endpoints)}")
        print(f"Pipeline metrics added: {len(pipeline_metrics)}")
        print("✓ Seed completed successfully!")
        print("=" * 60)

    except Exception as error:
        print(f"✗ Error during seeding: {error}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_wallets()
