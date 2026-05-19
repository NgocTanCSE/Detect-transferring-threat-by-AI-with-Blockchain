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
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path
from sqlalchemy import func, text
from sqlalchemy.exc import DatabaseError

from app.core.config import DATABASE_URL
from app.core.database import Base, SessionLocal, engine
from app.models.models import (
    Alert,
    AuditLog,
    Blacklist,
    BlockedTransfer,
    DiagnosticEvent,
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
DEFAULT_TX_PER_USER = int(os.getenv("LOCAL_DEMO_TX_PER_USER", "12")) # Higher volume for Analyst logic
DEFAULT_ALERTS = int(os.getenv("LOCAL_DEMO_ALERT_COUNT", "150"))
DEFAULT_BLOCKED = int(os.getenv("LOCAL_DEMO_BLOCKED_COUNT", "60"))
DEFAULT_CASES = int(os.getenv("LOCAL_DEMO_CASE_COUNT", "100"))
RANDOM_SEED = int(os.getenv("LOCAL_DEMO_SEED", "1337"))
RESET_DB = os.getenv("RESET_DB", "false").lower() == "true"

ROOT_ADDRESS = "0x0000000000000000000000000000000000000000"


def _sqlite_path_from_url(database_url: str) -> Path | None:
    if not database_url.startswith("sqlite:///"):
        return None
    if database_url.startswith("sqlite:////"):
        return Path(database_url.replace("sqlite:////", "/", 1))
    return Path(database_url.replace("sqlite:///", "", 1))


def _sqlite_integrity_ok(sqlite_path: Path) -> bool:
    if not sqlite_path.exists():
        return True
    connection: sqlite3.Connection | None = None
    try:
        connection = sqlite3.connect(str(sqlite_path))
        row = connection.execute("PRAGMA integrity_check;").fetchone()
        return bool(row and str(row[0]).lower() == "ok")
    except sqlite3.DatabaseError:
        return False
    finally:
        if connection is not None:
            connection.close()


def _cleanup_sqlite_files(sqlite_path: Path) -> None:
    for suffix in ("", "-wal", "-shm", "-journal"):
        candidate = Path(f"{sqlite_path}{suffix}")
        if candidate.exists():
            candidate.unlink()


@dataclass(frozen=True)
class SeedUser:
    user: User
    wallet: Wallet


def _eth(amount: float) -> Decimal:
    return Decimal(str(amount)) * Decimal("1000000000000000000")


def _make_address(rng: random.Random, index: int) -> str:
    return f"0x{index:040x}" if index < 16 else "0x" + "".join(rng.choice("0123456789abcdef") for _ in range(40))


def _make_id(prefix: str, index: int) -> int:
    import hashlib
    s = f"blockchain-ai::{prefix}::{index}"
    return int(hashlib.md5(s.encode()).hexdigest()[:14], 16)


def _pick(sequence, index: int):
    return sequence[index % len(sequence)]


def _create_test_accounts(now: datetime) -> list[tuple[str, str, str, str, str, str]]:
    """
    Create test accounts with plaintext passwords (will be hashed on login).
    Returns: [(username, email, password_hash, role, wallet_address, password_plain), ...]
    Note: Using plaintext in DB is OK for seed/dev - auth.py will verify via bcrypt on login
    """
    test_accounts = [
        ("admin", "admin@local.test", "admin123", "admin", "0x1111111111111111111111111111111111111111", "admin123"),
        ("analyst", "analyst@local.test", "analyst123", "analyst", "0x2222222222222222222222222222222222222222", "analyst123"),
        ("user", "user@local.test", "user123", "user", "0x3333333333333333333333333333333333333333", "user123"),
    ]

    return test_accounts


def _role_for_index(index: int) -> str:
    if index == 0:
        return "admin"
    if index % 17 == 0:
        return "analyst"
    return "user"


def _risk_score_for_index(index: int, rng: random.Random, user_count: int) -> float:
    # Purposeful distribution for 5k wallets: ~500 normal, remaining wallets spread across richer risk states.
    normal_cutoff = min(500, user_count)
    review_cutoff = min(normal_cutoff + int(user_count * 0.40), user_count)
    suspended_cutoff = min(review_cutoff + int(user_count * 0.30), user_count)

    if index < normal_cutoff:
        return round(rng.uniform(5.0, 34.0), 2)
    if index < review_cutoff:
        return round(rng.uniform(45.0, 69.0), 2)
    if index < suspended_cutoff:
        return round(rng.uniform(70.0, 84.0), 2)
    return round(rng.uniform(85.0, 99.8), 2)


def _status_for_score(score: float) -> tuple[str, str | None]:
    if score >= 85:
        return "frozen", "scam"
    if score >= 70:
        return "suspended", "manipulation"
    if score >= 45:
        return "under_review", "manipulation"
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
        # BSC demo wallets
        (
            "Dave BSC Trader",
            "0xbbb1111111111111111111111111111111111bbb",
            32.1,
            None,
            15,
            _eth(5.5),
            _eth(8.2),
        ),
        (
            "Eve BSC Bot",
            "0xccc2222222222222222222222222222222222ccc",
            67.8,
            "manipulation",
            28,
            _eth(12),
            _eth(3),
        ),
        (
            "Frank BSC Mixer",
            "0xfff3333333333333333333333333333333333fff",
            81.5,
            "scam",
            45,
            _eth(25),
            _eth(1.5),
        ),
    ]

    seed_rows: list[SeedUser] = []

    for index in range(user_count):
        # Determine which wallet config to use
        canonical_index = index % len(canonical_wallets)
        is_bsc_wallet = canonical_index >= 4  # BSC wallets start at index 4
        if index < len(canonical_wallets):
            label, address, risk_score, risk_category, total_transactions, total_sent, total_received = canonical_wallets[index]
        else:
            address = _make_address(rng, index)
            label = f"Demo Wallet {index:05d}"
            risk_score = _risk_score_for_index(index, rng, user_count)
            risk_category = _status_for_score(risk_score)[1]
            total_transactions = 10 + (index % 40)
            total_sent = _eth(rng.uniform(0.5, 25.0))
            total_received = total_sent + _eth(rng.uniform(0.5, 40.0))

        account_status, inferred_category = _status_for_score(risk_score)
        if risk_category is None:
            risk_category = inferred_category

        # Use plaintext password in seed (safe for dev, auth.py handles bcrypt verification on login)
        password_hash = "demo123"

        user = User(
            id=_make_id("user", index),
            username=f"demo_user_{index:05d}",
            email=f"demo_user_{index:05d}@local.test",
            password_hash=password_hash,
            role=_role_for_index(index),
            wallet_address=address,
            is_active=True,
            warning_count=0 if account_status == "active" else (2 if account_status == "under_review" else 3),
            last_login_at=now - timedelta(days=index % 14),
            created_at=now - timedelta(days=180 - (index % 60)),
            updated_at=now,
        )

        wallet = Wallet(
            id=_make_id("wallet", index),
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
            chain_id="bsc" if is_bsc_wallet else "ethereum",
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

            # More varied case status distribution for the Analyst dashboard
            case_status_opts = ["PENDING", "VERIFIED", "FRAUD", "IGNORED"]
            status_seed = (index + tx_index) % 4
            case_status = case_status_opts[status_seed]

            # Demonstrate assigned cases (Analyst ID from DB audit)
            ANALYST_ID = _make_id("user_test", hash("analyst") % 1000)
            assigned_to = None
            if index % 7 == 0:
                assigned_to = ANALYST_ID
            elif index % 13 == 0:
                assigned_to = seed.user.id

            transactions.append(
                Transaction(
                    id=_make_id("tx", index * tx_per_user + tx_index),
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
                    case_status=case_status,
                    assigned_to=assigned_to,
                    is_flagged=seed.wallet.risk_score >= 65 or (index + tx_index) % 10 == 0,
                    flag_reason=seed.wallet.risk_category if seed.wallet.risk_score >= 65 else "Suspicious Velocity",
                )
            )

    return transactions


def seed_wallets(retried_after_rebuild: bool = False) -> None:
    """Seed the local database with a richer demo dataset."""
    db_backend = "sqlite" if DATABASE_URL.startswith("sqlite") else "postgres"
    print(f"Using database backend: {db_backend}")

    sqlite_path = _sqlite_path_from_url(DATABASE_URL) if db_backend == "sqlite" else None
    if sqlite_path is not None:
        sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        if not _sqlite_integrity_ok(sqlite_path):
            print(f" Detected malformed SQLite database at {sqlite_path}. Rebuilding fresh database...")
            engine.dispose()
            _cleanup_sqlite_files(sqlite_path)

    if RESET_DB:
        print(" RESET_DB is TRUE. Performing deep clean of the database...")
        with engine.connect() as conn:
            # We use CASCADE to drop tables that might have foreign keys from other services
            conn.execute(text("DROP SCHEMA public CASCADE"))
            conn.execute(text("CREATE SCHEMA public"))
            conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
            # Ensure the database user has permissions (usually it does as owner, but for safety)
            user = DATABASE_URL.split(":")[1].replace("//", "")
            if "@" in user: # Handle postgresql://user:pass@host...
                 user = DATABASE_URL.split("//")[1].split(":")[0]
            
            # Note: In many local setups, 'public' is enough, but some envs might need explicit grants
            # conn.execute(text(f"GRANT ALL ON SCHEMA public TO {user}"))
            conn.commit()
        print(" Database schema wiped and recreated.")

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    now = datetime.utcnow()
    rng = random.Random(RANDOM_SEED)

    try:
        if RESET_DB:
            # We already dropped and recreated, but let's keep the logging for consistency
            print(" Database schema recreated.")
            tables_to_clear = [
                "alerts", "audit_logs", "blocked_transfers", "diagnostic_events",
                "feature_store_configs", "model_registry", "node_endpoints",
                "notification_events", "pipeline_metrics", "policy_rules",
                "transaction_cases", "transactions", "wallets", "users", "token_transfers",
                "risk_assessments", "user_warnings", "blacklist", "feedback_labels"
            ]
            db.commit() # Ensure clean state
            for table in tables_to_clear:
                try:
                    db.execute(text(f"DELETE FROM {table}"))
                    db.commit()
                    print(f" Cleared {table}")
                except Exception as e:
                    db.rollback()
                    print(f" Could not clear {table}: {e}")

        existing_wallets = set()
        existing_users = set()
        existing_tx_hashes = set()
        existing_alert_ids = set()
        existing_blocked_ids = set()
        existing_case_ids = set()
        existing_audit_ids = set()
        existing_notification_ids = set()
        existing_feature_ids = set()
        existing_node_ids = set()
        existing_policy_rules = set()
        existing_models = set()
        existing_pipeline_ids = set()

        seed_rows = _build_seed_users(DEFAULT_USER_COUNT, rng, now)
        _validate_seed_pairs(seed_rows)
        _attach_seed_note(seed_rows)
        users_to_add = [seed.user for seed in seed_rows if seed.user.username not in existing_users]
        wallets_to_add = [seed.wallet for seed in seed_rows if seed.wallet.address not in existing_wallets]

        # Create test accounts with real passwords
        print("\n" + "="*70)
        print("TEST ACCOUNTS FOR LOGIN")
        print("="*70)
        print(f"\n DEMO USERS (ALL): demo_user_00000 to demo_user_{DEFAULT_USER_COUNT-1:05d}")
        print(f"  Password: demo123")
        print(f"  Count: {DEFAULT_USER_COUNT} users")
        print(f"  Roles: 1 admin, ~{DEFAULT_USER_COUNT//17} analyst, rest are user")
        print()

        test_accounts = _create_test_accounts(now)
        funding_transactions = []
        for username, email, password_hash, role, wallet_address, password_plain in test_accounts:
            if username not in existing_users:
                test_user = User(
                    id=_make_id("user_test", hash(username) % 1000),
                    username=username,
                    email=email,
                    password_hash=password_hash,
                    role=role,
                    wallet_address=wallet_address,
                    is_active=True,
                    warning_count=0,
                    last_login_at=now,
                    created_at=now,
                    updated_at=now,
                )
                test_wallet = Wallet(
                    id=_make_id("wallet_test", hash(username) % 1000),
                    address=wallet_address,
                    label=f"Test {role.title()} Wallet",
                    entity_type="User",
                    account_status="active",
                    risk_score=10.0 if role == "admin" else 25.0,
                    risk_category=None,
                    total_transactions=5,
                    total_value_sent=_eth(1.0),
                    total_value_received=_eth(5.0),
                    first_seen_at=now,
                    last_activity_at=now,
                    notes=f"Test account for {role}",
                )
                users_to_add.append(test_user)
                wallets_to_add.append(test_wallet)
                print(f" Username: {username}")
                print(f"  Password: {password_plain}")
                print(f"  Role: {role}")
                print(f"  Wallet: {wallet_address}")
                print()
            # Determine virtual ETH based on role
            virtual_eth = 50.0
            if role == "admin":
                virtual_eth = 5000.0
            elif role == "analyst":
                virtual_eth = 200.0

            funding_transactions.append(
                Transaction(
                    id=_make_id("funding", hash(username) % 1000),
                    tx_hash=f"0xfund{hash(username) % 1000000000000000}"[:66],
                    from_address="0x0000000000000000000000000000000000000000",
                    to_address=wallet_address,
                    value=_eth(virtual_eth),
                    block_number=1000000 + (hash(username) % 1000),
                    timestamp=now - timedelta(days=5),
                    gas_price=_eth(0.00000002),
                    gas_used=21000,
                    input_data="0x",
                    status=1,
                    normalized_risk_score=0.0,
                    case_status="VERIFIED",
                    is_flagged=False
                )
            )

        print("="*70 + "\n")

        transactions_to_add = [tx for tx in _build_transactions(seed_rows, DEFAULT_TX_PER_USER, rng, now) if tx.tx_hash not in existing_tx_hashes]
        transactions_to_add.extend(funding_transactions)

        policy_rule_templates = [
            "Block High Risk Transfers", "Monitor Suspicious Velocity", "Require Manual Review for New Wallets",
            "Flag Contract Interactions", "Block Known Mixer Addresses", "Suspend Inactive Wallets",
            "Audit Large Value Transfers", "Review Fast Hop Transactions", "Escalate Blacklist Affinity",
            "Quarantine New Tokens", "Monitor Stablecoin Volume", "Check Geographic Consistency"
        ]

        policy_rules = []
        for index in range(120):
            rule_base = _pick(policy_rule_templates, index)
            rule_name = f"{rule_base} ({index})" if index >= len(policy_rule_templates) else rule_base
            policy_rules.append(
                PolicyRule(
                    id=_make_id("policy", index),
                    rule_name=rule_name,
                    description=f"Auto-generated policy rule for: {rule_name}",
                    min_risk_score=float(25.0 + (index % 70)),
                    block_blacklisted=(index % 2 == 0),
                    block_suspended=(index % 3 == 0),
                    notify_on_block=(index % 4 != 0),
                    priority=(index % 5) * 10,
                    is_active=(index % 6 != 0),
                    created_by=users_to_add[0].id if users_to_add else None,
                    created_at=now - timedelta(days=index % 30),
                    updated_at=now,
                )
            )

        policy_rules = [rule for rule in policy_rules if rule.rule_name not in existing_policy_rules]

        model_registry_base_names = [
            "risk_detector", "fraud_classifier", "wallet_scorer",
            "anomaly_analyzer", "tx_velocity_model", "contract_risk_engine",
            "hop_distance_analyzer", "pattern_matcher"
        ]
        frameworks = ["pkl", "onnx", "pt", "tf", "sklearn"]

        model_registry: list[ModelRegistry] = []
        for index in range(55):
            name = _pick(model_registry_base_names, index)
            # Use unique versions by incorporating index more aggressively
            v_seq = index // len(model_registry_base_names)
            version = f"v{v_seq + 1}.{(index % 3) + 1}.0"
            framework = _pick(frameworks, index)
            is_active = (index % 12 == 0)

            promoted_at = None
            promoted_by = None
            if index % 3 == 0:
                promoted_at = now - timedelta(days=rng.randint(1, 30))
                promoted_by = _pick(["admin", "ai_engineer_bot", "ml_ops_pipeline"], index)

            model_registry.append(
                ModelRegistry(
                    id=_make_id("model", index),
                    model_name=name,
                    version=version,
                    artifact_uri=f"s3://production-models/{name}/{version}.{framework}",
                    framework=framework,
                    is_active=is_active,
                    promoted_by=None,
                    promoted_at=promoted_at,
                    created_at=now - timedelta(days=60 - index),
                )
            )
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
        alert_types = [
            "Risk Spike", "Flash Loan Detected", "Mixer Interaction",
            "Layer 2 Bridge Anomaly", "High-Frequency Wash Trade",
            "Wallet Drainer Pattern", "Sanctioned Entity Proximity"
        ]
        severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]

        for index in range(1200):
            seed = _pick(seed_rows, index)
            alerts.append(
                Alert(
                    id=_make_id("alert", index),
                    wallet_address=seed.wallet.address,
                    alert_type=_pick(alert_types, index),
                    severity=_pick(severities, index // 2), # Weight towards higher severities
                    message=f"Suspicious activity detected on {seed.wallet.label}: {_pick(alert_types, index)}",
                    risk_score=seed.wallet.risk_score,
                    meta={"label": seed.wallet.label, "source": "ai_engine"},
                    detected_at=now - timedelta(days=index // 50, hours=index % 24),
                    acknowledged=index % 5 == 0,
                    acknowledged_at=now - timedelta(hours=index % 12) if index % 5 == 0 else None,
                    acknowledged_by=users_to_add[0].username if users_to_add else None,
                )
            )

        alerts = [alert for alert in alerts if alert.id not in existing_alert_ids]

        for index, seed in enumerate(risky_wallets[:DEFAULT_BLOCKED]):
            sender_user = seed.user
            receiver = _pick(seed_rows, index + 7).wallet.address
            blocked_transfers.append(
                BlockedTransfer(
                    id=_make_id("blocked", index),
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

        # Use the specific analyst ID to show 'Assigned to me' features
        ANALYST_ID = _make_id("user_test", hash("analyst") % 1000)
        case_states = ["PENDING", "VERIFIED", "FRAUD", "IGNORED"]
        case_actions = ["ASSIGN", "CONFIRM_FRAUD", "DISMISS", "ESCALATE"]

        for index in range(650):
            tx = _pick(transactions_to_add, index)
            # Assign 40% to the specific analyst user
            assigned_user = ANALYST_ID if (index % 10 < 4) else (users_to_add[index % len(users_to_add)].id if users_to_add else None)

            transaction_cases.append(
                TransactionCase(
                    id=_make_id("case", index),
                    tx_hash=tx.tx_hash,
                    analyst_id=assigned_user,
                    action=_pick(case_actions, index),
                    state=_pick(case_states, index % 4),
                    note=f"Seeded security review for {tx.tx_hash[:12]}. State set to {_pick(case_states, index % 4)}.",
                    created_at=now - timedelta(days=index // 30, minutes=index % 60),
                    updated_at=now,
                )
            )

        transaction_cases = [case for case in transaction_cases if case.id not in existing_case_ids]

        for index in range(1500):
            seed = _pick(seed_rows, index)
            action_type = _pick(["CREATE", "UPDATE", "BLOCK", "REVIEW", "EXPORT", "ESCALATE", "VERIFY"], index)
            entity_type = _pick(["wallet", "transaction", "policy", "user", "alert"], index)
            audit_logs.append(
                AuditLog(
                    id=_make_id("audit", index),
                    action_type=action_type,
                    entity_type=entity_type,
                    entity_id=_make_id("wallet", index) if entity_type == "wallet" else index,
                    user_identifier=seed.user.username,
                    ip_address=f"10.0.{index % 16}.{(index % 200) + 1}",
                    details={"action": action_type, "target": entity_type, "risk": seed.wallet.risk_score},
                    timestamp=now - timedelta(hours=index % 720, minutes=index % 60),
                )
            )

        audit_logs = [audit for audit in audit_logs if audit.id not in existing_audit_ids]

        for index in range(450):
            seed = _pick(seed_rows, index)
            notifications.append(
                NotificationEvent(
                    id=_make_id("notification", index),
                    channel=_pick(["slack", "email", "webhook", "telegram"], index),
                    recipient=f"security-ops-{index:03d}@local.test",
                    severity=_pick(["LOW", "MEDIUM", "HIGH", "CRITICAL"], index),
                    message=f"Security event on {seed.wallet.label}: High-risk transfer from {seed.wallet.address[:10]}...",
                    status=_pick(["queued", "sent", "failed"], index),
                    meta={"wallet": seed.wallet.address, "source": "security_engine"},
                    created_at=now - timedelta(days=index // 20, minutes=index % 60),
                    sent_at=now - timedelta(minutes=index % 60) if index % 3 != 0 else None,
                )
            )

        notifications = [notification for notification in notifications if notification.id not in existing_notification_ids]

        feature_keys_templates = [
            "avg_tx_val_{d}d", "unique_receivers_{h}h", "hop_count_to_exchange",
            "contract_interaction_ratio", "tx_velocity_spike", "gas_usage_percentile",
            "blacklist_affinity_score", "new_account_flag", "stablecoin_volume_sum",
            "mixer_interaction_event", "large_transfer_count"
        ]

        for index in range(110):
            base_key = _pick(feature_keys_templates, index)
            # Ensure uniqueness by appending index if template doesn't have placeholders
            d_val = (index % 30) + 1
            if "{d}" in base_key or "{h}" in base_key:
                feature_key = base_key.replace("{d}", str(d_val)).replace("{h}", str(d_val * 2))
            else:
                feature_key = f"{base_key}_{index:03d}"

            expressions = [
                f"SUM(value) / {d_val}",
                f"COUNT(DISTINCT counterparty) > {index % 10}",
                f"risk_score * {1.1 + (index/100)}",
                f"CASE WHEN gas > 50000 THEN 1 ELSE 0 END",
                f"LAG(timestamp) OVER (PARTITION BY wallet ORDER BY timestamp)"
            ]

            feature_configs.append(
                FeatureStoreConfig(
                    id=_make_id("feature", index),
                    feature_key=feature_key,
                    enabled=index % 5 != 0,
                    expression=_pick(expressions, index),
                    owner_user_id=users_to_add[index % len(users_to_add)].id if users_to_add else None,
                    created_at=now - timedelta(days=40 - (index % 30)),
                    updated_at=now,
                )
            )

        feature_configs = [feature for feature in feature_configs if feature.id not in existing_feature_ids]

        for index in range(120):
            status = _pick(["healthy", "healthy", "healthy", "degraded", "down", "healthy"], index)
            providers = ["Alchemy", "Infura", "QuickNode", "Ankr", "Lava", "Blast", "Bware", "Chainstack"]
            chains = ["ethereum", "polygon", "arbitrum", "optimism", "base", "bsc"]

            node_endpoints.append(
                NodeEndpoint(
                    id=_make_id("node", index),
                    provider_name=_pick(providers, index),
                    chain=_pick(chains, index),
                    endpoint_url=f"https://{_pick(chains, index)}-{index}.local-mesh.io/rpc",
                    protocol=_pick(["http", "websocket"], index),
                    priority=10 + (index % 50),
                    is_active=True,
                    health_status=status,
                    last_error=None if status != "down" else "Timeout while contacting upstream node",
                    last_checked_at=now - timedelta(minutes=index % 60),
                    created_at=now - timedelta(days=25 - (index % 20)),
                    updated_at=now,
                )
            )

            node_endpoints = [node for node in node_endpoints if node.id not in existing_node_ids]

        for index in range(500):
            chains = ["ethereum", "polygon", "arbitrum", "optimism", "base", "bsc"]
            pipeline_metrics.append(
                PipelineMetric(
                    id=index + 10000,
                    chain=_pick(chains, index),
                    block_number=18_000_000 + index * 11,
                    throughput_tps=Decimal(str(round(42.5 + (index % 12) * 3.1, 2))),
                    ingestion_latency_ms=150 + (index % 15) * 12,
                    decode_latency_ms=200 + (index % 18) * 15,
                    inserted_at=now - timedelta(minutes=index * 5),
                )
            )

        pipeline_metrics = [metric for metric in pipeline_metrics if metric.id not in existing_pipeline_ids]

        def _robust_add(items, description):
            print(f"Adding {description} ({len(items)})...")
            count = 0
            for item in items:
                try:
                    db.add(item)
                    db.commit()
                    count += 1
                except Exception as e:
                    print(f"Failed to add item: {e}")
                    db.rollback()
            print(f" Added {count} {description}")

        diagnostic_events: list[DiagnosticEvent] = []
        log_types = ["INFO", "ERROR", "WARNING", "SUCCESS", "DEBUG"]
        log_messages = [
            ("INFO", "api", "/api/v1/auth/login", 200, "User login successful for session {uuid}"),
            ("ERROR", "api", "/api/v1/wallets/risk", 500, "Timeout while contacting inference service"),
            ("INFO", "scanner", "/blockchain/scan", 200, "Block scan completed for height {block}"),
            ("WARNING", "backend", "/api/v1/policies", 401, "Unauthorized policy update attempt"),
            ("SUCCESS", "scanner", "/blockchain/monitor", 201, "New suspicious transaction flagged: {tx}"),
            ("INFO", "api", "/api/v1/nodes/health", 200, "Node endpoint check status: healthy"),
            ("ERROR", "backend", "/db/connect", 503, "Database connection pool exhausted"),
            ("INFO", "api", "/api/v1/alerts", 200, "Broadcasted {count} alerts to active analysts"),
            ("DEBUG", "scanner", "/blockchain/ingest", 200, "Ingested raw block data size: {size}KB"),
            ("SUCCESS", "backend", "/api/v1/models/promote", 200, "Model {model} promoted to production"),
        ]

        for index in range(250):
            log_template = _pick(log_messages, index)
            typ, source, endpoint, status_code, msg_tpl = log_template

            message = msg_tpl.format(
                uuid=_make_id("session", index),
                block=18000000 + index,
                tx=f"0x{_make_id('tx_log', index):x}"[:10],
                count=rng.randint(1, 15),
                size=rng.randint(100, 2500),
                model=f"v{rng.randint(1, 3)}.{rng.randint(0, 9)}",
            )

            diagnostic_events.append(
                DiagnosticEvent(
                    id=_make_id("diag", index),
                    log_type=typ,
                    message=message,
                    details={"source": source, "index": index, "env": "local-demo"},
                    status_code=status_code,
                    endpoint=endpoint,
                    source=source,
                    is_archived=index % 25 == 0,
                    archived_at=now if index % 25 == 0 else None,
                    timestamp=now - timedelta(minutes=index * 3),
                )
            )

        _robust_add(users_to_add, "users")
        _robust_add(wallets_to_add, "wallets")
        _robust_add(transactions_to_add, "transactions")
        _robust_add(policy_rules, "policy rules")
        _robust_add(model_registry, "model registry")
        _robust_add(alerts, "alerts")
        _robust_add(blocked_transfers, "blocked transfers")
        _robust_add(transaction_cases, "transaction cases")
        _robust_add(audit_logs, "audit logs")
        _robust_add(notifications, "notifications")
        _robust_add(feature_configs, "feature configs")
        _robust_add(node_endpoints, "node endpoints")
        _robust_add(pipeline_metrics, "pipeline metrics")
        _robust_add(diagnostic_events, "diagnostic events")

        existing_blacklist = db.query(Blacklist).filter(Blacklist.address == "0xdead1000000000000000000000000000000dead").first()
        if not existing_blacklist:
            db.add(
                Blacklist(
                    id=_make_id("blacklist", 1),
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

        # Post-seed verification report (total records, not only rows added in this run)
        total_users = db.query(func.count(User.id)).scalar() or 0
        total_wallets = db.query(func.count(Wallet.id)).scalar() or 0
        total_transactions = db.query(func.count(Transaction.id)).scalar() or 0
        total_alerts = db.query(func.count(Alert.id)).scalar() or 0
        total_blocked = db.query(func.count(BlockedTransfer.id)).scalar() or 0
        total_cases = db.query(func.count(TransactionCase.id)).scalar() or 0
        total_notifications = db.query(func.count(NotificationEvent.id)).scalar() or 0
        total_features = db.query(func.count(FeatureStoreConfig.id)).scalar() or 0
        total_nodes = db.query(func.count(NodeEndpoint.id)).scalar() or 0
        total_pipeline = db.query(func.count(PipelineMetric.id)).scalar() or 0
        total_policies = db.query(func.count(PolicyRule.id)).scalar() or 0
        total_models = db.query(func.count(ModelRegistry.id)).scalar() or 0

        wallet_status_counts = {
            status: count
            for status, count in db.query(Wallet.account_status, func.count(Wallet.id)).group_by(Wallet.account_status).all()
        }
        risk_category_counts = {
            (category or "none"): count
            for category, count in db.query(Wallet.risk_category, func.count(Wallet.id)).group_by(Wallet.risk_category).all()
        }
        alert_severity_counts = {
            severity: count
            for severity, count in db.query(Alert.severity, func.count(Alert.id)).group_by(Alert.severity).all()
        }
        case_state_counts = {
            state: count
            for state, count in db.query(TransactionCase.state, func.count(TransactionCase.id)).group_by(TransactionCase.state).all()
        }
        notification_status_counts = {
            status: count
            for status, count in db.query(NotificationEvent.status, func.count(NotificationEvent.id)).group_by(NotificationEvent.status).all()
        }

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
        print("-" * 60)
        print("TOTAL RECORDS CURRENTLY IN DB")
        print(f"Users: {total_users}")
        print(f"Wallets: {total_wallets}")
        print(f"Transactions: {total_transactions}")
        print(f"Alerts: {total_alerts}")
        print(f"Blocked transfers: {total_blocked}")
        print(f"Cases: {total_cases}")
        print(f"Notifications: {total_notifications}")
        print(f"Feature configs: {total_features}")
        print(f"Node endpoints: {total_nodes}")
        print(f"Pipeline metrics: {total_pipeline}")
        print(f"Policy rules: {total_policies}")
        print(f"Model registry rows: {total_models}")
        print("-" * 60)
        print("DISTRIBUTION SNAPSHOT")
        print(f"Wallet status: {wallet_status_counts}")
        print(f"Risk category: {risk_category_counts}")
        print(f"Alert severity: {alert_severity_counts}")
        print(f"Case state: {case_state_counts}")
        print(f"Notification status: {notification_status_counts}")
        print(" Seed completed successfully!")
        print("=" * 60)

    except DatabaseError as error:
        if (
            db_backend == "sqlite"
            and not retried_after_rebuild
            and "malformed" in str(error).lower()
            and sqlite_path is not None
        ):
            print(" SQLite reported malformed image during seed. Rebuilding once and retrying...")
            db.rollback()
            db.close()
            engine.dispose()
            _cleanup_sqlite_files(sqlite_path)
            Base.metadata.create_all(bind=engine)
            return seed_wallets(retried_after_rebuild=True)

        print(f" Error during seeding: {error}")
        db.rollback()
        raise
    except Exception as error:
        print(f" Error during seeding: {error}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_wallets()
