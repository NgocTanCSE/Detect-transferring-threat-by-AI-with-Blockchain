"""SQLAlchemy ORM models for blockchain risk assessment database."""

import uuid
from datetime import datetime

from sqlalchemy import Column, String, Float, DateTime, ForeignKey, BigInteger, DECIMAL, Text, func, SmallInteger, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import relationship

from app.core.database import Base


class User(Base):
    """Platform user account (admin, analyst, regular user)."""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default='user')  # admin, analyst, user
    wallet_address = Column(String(255), unique=True, nullable=True, index=True)
    is_active = Column(Boolean, default=True)
    warning_count = Column(Integer, default=0)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    warnings = relationship("UserWarning", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User(username={self.username}, role={self.role}, warnings={self.warning_count})>"


class TokenTransfer(Base):
    """ERC20/ERC721 token transfer record from Alchemy."""

    __tablename__ = "token_transfers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    transaction_hash = Column(String(66), nullable=False, index=True)
    block_number = Column(BigInteger, nullable=False)
    log_index = Column(BigInteger, nullable=False)
    token_address = Column(String(255), nullable=False, index=True)
    token_symbol = Column(String(20), nullable=True)
    token_name = Column(String(100), nullable=True)
    token_decimals = Column(BigInteger, default=18)
    from_address = Column(String(255), nullable=False, index=True)
    to_address = Column(String(255), nullable=False, index=True)
    value = Column(DECIMAL(78, 0), nullable=False)
    value_decimal = Column(DECIMAL(38, 18), nullable=True)
    transfer_type = Column(String(20), default='ERC20')
    timestamp = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self) -> str:
        return f"<TokenTransfer(token={self.token_symbol}, from={self.from_address[:10]}, value={self.value_decimal})>"


class Wallet(Base):
    """Ethereum wallet address with risk assessment metadata."""

    __tablename__ = "wallets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    address = Column(String(255), unique=True, index=True, nullable=False)
    label = Column(String(255), nullable=True)
    entity_type = Column(String(50), default='Unknown')
    account_status = Column(String(20), default='active')  # active, suspended, frozen, under_review
    risk_score = Column(Float, default=0.0)
    risk_category = Column(String(50), nullable=True)  # money_laundering, manipulation, scam
    total_transactions = Column(BigInteger, default=0)
    total_value_sent = Column(DECIMAL(78, 0), default=0)
    total_value_received = Column(DECIMAL(78, 0), default=0)
    first_seen_at = Column(DateTime(timezone=True), nullable=True)
    last_activity_at = Column(DateTime(timezone=True), nullable=True)
    flagged_at = Column(DateTime(timezone=True), nullable=True)
    flagged_by = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    risk_assessments = relationship("RiskAssessment", back_populates="wallet", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Wallet(address={self.address}, status={self.account_status}, risk_score={self.risk_score})>"


class Transaction(Base):
    """Blockchain transaction record from Etherscan."""

    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tx_hash = Column(String(66), unique=True, index=True, nullable=False)
    from_address = Column(String(255), index=True, nullable=False)
    to_address = Column(String(255), index=True, nullable=True)
    value = Column(DECIMAL(78, 0), nullable=True)
    block_number = Column(BigInteger, nullable=True)
    timestamp = Column(DateTime(timezone=True), index=True, nullable=True)
    gas_price = Column(DECIMAL(78, 0), nullable=True)
    gas_used = Column(BigInteger, nullable=True)
    input_data = Column(Text, nullable=True)
    status = Column(SmallInteger, default=1)  # 1=success, 0=failed
    normalized_risk_score = Column(DECIMAL(3, 2), nullable=True)  # 0.00 - 1.00
    case_status = Column(String(20), nullable=False, default='PENDING', index=True)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_flagged = Column(Boolean, default=False)
    flag_reason = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self) -> str:
        return f"<Transaction(hash={self.tx_hash[:10]}..., value={self.value})>"


class RiskAssessment(Base):
    """Historical risk assessment record for a wallet."""

    __tablename__ = "risk_assessments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    wallet_id = Column(UUID(as_uuid=True), ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Float, nullable=False)
    risk_level = Column(String(20), nullable=False)
    details = Column(JSONB, nullable=True)
    model_version = Column(String(50), nullable=True)
    assessed_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    wallet = relationship("Wallet", back_populates="risk_assessments")

    def __repr__(self) -> str:
        return f"<RiskAssessment(wallet_id={self.wallet_id}, level={self.risk_level}, score={self.score})>"


class Blacklist(Base):
    """Known malicious or sanctioned wallet addresses."""

    __tablename__ = "blacklist"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    address = Column(String(255), unique=True, index=True, nullable=False)
    category = Column(String(100), nullable=True)
    source = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    severity = Column(String(20), default='HIGH')
    is_active = Column(Boolean, default=True)
    reported_at = Column(DateTime(timezone=True), server_default=func.now())
    verified_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<Blacklist(address={self.address}, category={self.category})>"


class Alert(Base):
    """Real-time security alerts generated by scanner service."""

    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    wallet_address = Column(String(255), index=True, nullable=False)
    alert_type = Column(String(100), nullable=False)
    severity = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    risk_score = Column(Float, nullable=True)
    meta = Column('metadata', JSONB, nullable=True)
    detected_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    acknowledged = Column(Boolean, default=False)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_by = Column(String(255), nullable=True)

    def __repr__(self) -> str:
        return f"<Alert(wallet={self.wallet_address[:10]}, severity={self.severity}, score={self.risk_score})>"


class BlockedTransfer(Base):
    """Records all blocked transaction attempts for audit."""

    __tablename__ = "blocked_transfers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    sender_address = Column(String(255), nullable=False, index=True)
    receiver_address = Column(String(255), nullable=False, index=True)
    amount = Column(DECIMAL(78, 0), nullable=False)
    risk_score = Column(Float, nullable=True)
    block_reason = Column(String(100), nullable=False)
    user_warning_count = Column(Integer, default=0)
    sender_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    blocked_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def __repr__(self) -> str:
        return f"<BlockedTransfer(from={self.sender_address[:10]}, to={self.receiver_address[:10]}, reason={self.block_reason})>"


class UserWarning(Base):
    """Tracks user warnings for ignoring risk alerts (3 strikes = suspension)."""

    __tablename__ = "user_warnings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    wallet_address = Column(String(255), nullable=False, index=True)
    target_address = Column(String(255), nullable=False)
    warning_type = Column(String(50), nullable=False)
    risk_score = Column(Float, nullable=True)
    user_action = Column(String(20), nullable=True)  # ignored, cancelled, reported
    warning_number = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    user = relationship("User", back_populates="warnings")

    def __repr__(self) -> str:
        return f"<UserWarning(wallet={self.wallet_address[:10]}, warning_num={self.warning_number})>"


class AuditLog(Base):
    """System-wide audit trail for compliance and forensics."""

    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    action_type = Column(String(50), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    user_identifier = Column(String(255), nullable=True)
    ip_address = Column(INET, nullable=True)
    details = Column(JSONB, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def __repr__(self) -> str:
        return f"<AuditLog(action={self.action_type}, entity={self.entity_type})>"


class FeedbackLabel(Base):
    """
    Admin feedback on AI predictions for model retraining.

    Stores corrections when admin confirms or rejects AI verdicts,
    enabling supervised learning feedback loop.
    """

    __tablename__ = "feedback_labels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    wallet_address = Column(String(255), nullable=False, index=True)

    # AI prediction at time of feedback
    ai_score = Column(Float, nullable=False)
    ai_risk_level = Column(String(20), nullable=False)
    ai_model_version = Column(String(50), nullable=True)

    # Admin correction
    admin_label = Column(String(20), nullable=False)  # 'fraud', 'safe', 'uncertain'
    admin_category = Column(String(50), nullable=True)  # money_laundering, scam, wash_trading
    admin_notes = Column(Text, nullable=True)
    admin_username = Column(String(100), nullable=False, index=True)

    # Metadata
    used_for_training = Column(Boolean, default=False, index=True)
    training_batch_id = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def __repr__(self) -> str:
        return f"<FeedbackLabel(wallet={self.wallet_address[:10]}, label={self.admin_label}, by={self.admin_username})>"


class TransactionCase(Base):
    """Case-management audit trail for analyst actions on a transaction."""

    __tablename__ = "transaction_cases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    # Avoid FK to partitioned transactions table, which does not expose a compatible unique key for tx_hash.
    tx_hash = Column(String(66), nullable=False, index=True)
    analyst_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String(20), nullable=False)  # ASSIGN, CONFIRM_FRAUD, DISMISS, ESCALATE
    state = Column(String(20), nullable=False, default='PENDING')  # PENDING, VERIFIED, FRAUD, IGNORED
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<TransactionCase(tx_hash={self.tx_hash[:10]}..., action={self.action}, state={self.state})>"


class NodeEndpoint(Base):
    """Configurable blockchain node endpoints for failover and health monitoring."""

    __tablename__ = "node_endpoints"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    provider_name = Column(String(100), nullable=False, index=True)
    chain = Column(String(50), nullable=False, index=True)
    endpoint_url = Column(String(1024), nullable=False)
    protocol = Column(String(20), nullable=False, default='http')  # http, websocket
    priority = Column(Integer, nullable=False, default=100)
    is_active = Column(Boolean, default=True, index=True)
    health_status = Column(String(20), nullable=False, default='unknown')  # healthy, degraded, down, unknown
    last_error = Column(Text, nullable=True)
    last_checked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<NodeEndpoint(provider={self.provider_name}, chain={self.chain}, status={self.health_status})>"


class PipelineMetric(Base):
    """Operational metrics for ingestion and decode pipeline performance."""

    __tablename__ = "pipeline_metrics"

    id = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    chain = Column(String(50), nullable=False, index=True)
    block_number = Column(BigInteger, nullable=True, index=True)
    throughput_tps = Column(DECIMAL(10, 2), nullable=True)
    ingestion_latency_ms = Column(Integer, nullable=True)
    decode_latency_ms = Column(Integer, nullable=True)
    inserted_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def __repr__(self) -> str:
        return f"<PipelineMetric(chain={self.chain}, tps={self.throughput_tps}, ingest_ms={self.ingestion_latency_ms})>"


class FeatureStoreConfig(Base):
    """Feature definitions and toggle states used by inference pipelines."""

    __tablename__ = "feature_store_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    feature_key = Column(String(100), nullable=False, unique=True, index=True)
    enabled = Column(Boolean, default=True, index=True)
    expression = Column(Text, nullable=True)
    owner_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<FeatureStoreConfig(key={self.feature_key}, enabled={self.enabled})>"


class ModelRegistry(Base):
    """Model artifacts, versions, and active deployment status."""

    __tablename__ = "model_registry"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    model_name = Column(String(100), nullable=False, index=True)
    version = Column(String(50), nullable=False, index=True)
    artifact_uri = Column(String(1024), nullable=False)
    framework = Column(String(20), nullable=False, default='pkl')  # pkl, onnx, pt
    is_active = Column(Boolean, default=False, index=True)
    promoted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    promoted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self) -> str:
        return f"<ModelRegistry(name={self.model_name}, version={self.version}, active={self.is_active})>"


class PolicyRule(Base):
    """Compliance policy rule definitions for transfer governance decisions."""

    __tablename__ = "policy_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    rule_name = Column(String(120), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    min_risk_score = Column(Float, nullable=False, default=80.0)
    block_blacklisted = Column(Boolean, default=True)
    block_suspended = Column(Boolean, default=True)
    notify_on_block = Column(Boolean, default=True)
    priority = Column(Integer, nullable=False, default=100)
    is_active = Column(Boolean, default=True, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<PolicyRule(name={self.rule_name}, risk={self.min_risk_score}, active={self.is_active})>"


class NotificationEvent(Base):
    """Notification event log for alert/escalation channels."""

    __tablename__ = "notification_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    channel = Column(String(30), nullable=False, index=True)  # slack, telegram, email, webhook
    recipient = Column(String(255), nullable=False)
    severity = Column(String(20), nullable=False, default="MEDIUM", index=True)
    message = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="queued", index=True)  # queued, sent, failed
    meta = Column('metadata', JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<NotificationEvent(channel={self.channel}, severity={self.severity}, status={self.status})>"

