"""Database connection and session management."""

import logging
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import sessionmaker, declarative_base, Session

from app.core.config import DATABASE_URL

logger = logging.getLogger(__name__)

_DATABASE_BACKEND = make_url(DATABASE_URL).get_backend_name()
_IS_SQLITE = _DATABASE_BACKEND == "sqlite"

if _IS_SQLITE and DATABASE_URL.startswith("sqlite:////"):
    sqlite_file = DATABASE_URL.replace("sqlite:////", "/", 1)
    Path(sqlite_file).parent.mkdir(parents=True, exist_ok=True)

_engine_kwargs = {"pool_pre_ping": True}
if _IS_SQLITE:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    _engine_kwargs["pool_size"] = 10
    _engine_kwargs["max_overflow"] = 20

engine = create_engine(
    DATABASE_URL,
    **_engine_kwargs,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def ensure_schema() -> None:
    """Best-effort schema migrations for dev environments.

    This project does not currently use Alembic migrations. The Postgres volume may
    persist across runs, so columns added in ORM models might be missing in the DB.

    Currently ensures:
    - `transactions.status` exists (SMALLINT, default 1)
    - `transactions.normalized_risk_score` exists (NUMERIC(3,2), 0.00-1.00)
    - `transactions.case_status` exists (PENDING/VERIFIED/FRAUD/IGNORED)
    - `transactions.assigned_to` exists (UUID)
    - `transactions.updated_at` exists (TIMESTAMPTZ)
    - `alerts.metadata` exists (JSONB)
    - `alerts.acknowledged` is BOOLEAN (casts from 'true'/'false' strings if needed)
    - `alerts.acknowledged_at` exists (TIMESTAMPTZ)
    - `alerts.acknowledged_by` exists (VARCHAR)
    - `blacklist.severity` exists
    - `blacklist.is_active` exists
    - `blacklist.verified_at` exists (TIMESTAMPTZ)
    - `blacklist.expires_at` exists (TIMESTAMPTZ)
    """
    if _IS_SQLITE:
        logger.info("SQLite backend detected; skipping Postgres-specific ensure_schema migrations")
        return

    try:
        with engine.begin() as connection:
            # Ensure core table exists in long-lived dev volumes where create_all may have been skipped.
            connection.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS alerts (
                        id UUID PRIMARY KEY,
                        wallet_address VARCHAR(255) NOT NULL,
                        alert_type VARCHAR(100) NOT NULL,
                        severity VARCHAR(20) NOT NULL,
                        message TEXT NOT NULL,
                        risk_score DOUBLE PRECISION,
                        metadata JSONB,
                        detected_at TIMESTAMPTZ DEFAULT NOW(),
                        acknowledged BOOLEAN DEFAULT false,
                        acknowledged_at TIMESTAMPTZ,
                        acknowledged_by VARCHAR(255)
                    )
                    """
                )
            )
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_alerts_wallet ON alerts (wallet_address)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_alerts_detected ON alerts (detected_at DESC)"))

            connection.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS blacklist (
                        id UUID PRIMARY KEY,
                        address VARCHAR(255) NOT NULL UNIQUE,
                        category VARCHAR(100),
                        source VARCHAR(255),
                        description TEXT,
                        severity VARCHAR(20) DEFAULT 'HIGH',
                        is_active BOOLEAN DEFAULT true,
                        reported_at TIMESTAMPTZ DEFAULT NOW(),
                        verified_at TIMESTAMPTZ,
                        expires_at TIMESTAMPTZ
                    )
                    """
                )
            )
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_blacklist_address ON blacklist (address)"))

            connection.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS blocked_transfers (
                        id UUID PRIMARY KEY,
                        sender_address VARCHAR(255) NOT NULL,
                        receiver_address VARCHAR(255) NOT NULL,
                        amount NUMERIC(78,0) NOT NULL,
                        risk_score DOUBLE PRECISION,
                        block_reason VARCHAR(100) NOT NULL,
                        user_warning_count INTEGER DEFAULT 0,
                        sender_user_id UUID,
                        blocked_at TIMESTAMPTZ DEFAULT NOW()
                    )
                    """
                )
            )
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_blocked_transfers_blocked_at ON blocked_transfers (blocked_at DESC)"))

            connection.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS audit_logs (
                        id UUID PRIMARY KEY,
                        action_type VARCHAR(50) NOT NULL,
                        entity_type VARCHAR(50) NOT NULL,
                        entity_id UUID,
                        user_identifier VARCHAR(255),
                        ip_address INET,
                        details JSONB,
                        timestamp TIMESTAMPTZ DEFAULT NOW()
                    )
                    """
                )
            )
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit_logs (timestamp DESC)"))

            connection.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS node_endpoints (
                        id UUID PRIMARY KEY,
                        provider_name VARCHAR(100) NOT NULL,
                        chain VARCHAR(50) NOT NULL,
                        endpoint_url VARCHAR(1024) NOT NULL,
                        protocol VARCHAR(20) NOT NULL DEFAULT 'http',
                        priority INTEGER NOT NULL DEFAULT 100,
                        is_active BOOLEAN DEFAULT true,
                        health_status VARCHAR(20) NOT NULL DEFAULT 'unknown',
                        last_error TEXT,
                        last_checked_at TIMESTAMPTZ,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    )
                    """
                )
            )
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_node_endpoints_chain ON node_endpoints (chain)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_node_endpoints_active ON node_endpoints (is_active)"))

            connection.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS pipeline_metrics (
                        id BIGSERIAL PRIMARY KEY,
                        chain VARCHAR(50) NOT NULL,
                        block_number BIGINT,
                        throughput_tps NUMERIC(10,2),
                        ingestion_latency_ms INTEGER,
                        decode_latency_ms INTEGER,
                        inserted_at TIMESTAMPTZ DEFAULT NOW()
                    )
                    """
                )
            )
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_inserted_at ON pipeline_metrics (inserted_at DESC)"))

            connection.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS feature_store_configs (
                        id UUID PRIMARY KEY,
                        feature_key VARCHAR(100) NOT NULL UNIQUE,
                        enabled BOOLEAN DEFAULT true,
                        expression TEXT,
                        owner_user_id UUID,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    )
                    """
                )
            )

            connection.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS model_registry (
                        id UUID PRIMARY KEY,
                        model_name VARCHAR(100) NOT NULL,
                        version VARCHAR(50) NOT NULL,
                        artifact_uri VARCHAR(1024) NOT NULL,
                        framework VARCHAR(20) NOT NULL DEFAULT 'pkl',
                        is_active BOOLEAN DEFAULT false,
                        promoted_by UUID,
                        promoted_at TIMESTAMPTZ,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    )
                    """
                )
            )

            connection.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS diagnostic_events (
                        id UUID PRIMARY KEY,
                        log_type VARCHAR(30) NOT NULL,
                        message TEXT NOT NULL,
                        details JSONB,
                        status_code INTEGER,
                        endpoint VARCHAR(255),
                        source VARCHAR(50) NOT NULL DEFAULT 'backend',
                        is_archived BOOLEAN NOT NULL DEFAULT false,
                        archived_at TIMESTAMPTZ,
                        timestamp TIMESTAMPTZ DEFAULT NOW()
                    )
                    """
                )
            )
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_diagnostic_events_timestamp ON diagnostic_events (timestamp DESC)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_diagnostic_events_type ON diagnostic_events (log_type)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_diagnostic_events_archived ON diagnostic_events (is_archived)"))

            connection.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS policy_rules (
                        id UUID PRIMARY KEY,
                        rule_name VARCHAR(120) NOT NULL UNIQUE,
                        description TEXT,
                        min_risk_score DOUBLE PRECISION NOT NULL DEFAULT 80.0,
                        block_blacklisted BOOLEAN DEFAULT true,
                        block_suspended BOOLEAN DEFAULT true,
                        notify_on_block BOOLEAN DEFAULT true,
                        priority INTEGER NOT NULL DEFAULT 100,
                        is_active BOOLEAN DEFAULT true,
                        created_by UUID,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    )
                    """
                )
            )

            connection.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS notification_events (
                        id UUID PRIMARY KEY,
                        channel VARCHAR(30) NOT NULL,
                        recipient VARCHAR(255) NOT NULL,
                        severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
                        message TEXT NOT NULL,
                        status VARCHAR(20) NOT NULL DEFAULT 'queued',
                        metadata JSONB,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        sent_at TIMESTAMPTZ
                    )
                    """
                )
            )
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_notification_events_channel ON notification_events (channel)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_notification_events_status ON notification_events (status)"))

            transactions_exists = connection.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_name = 'transactions'
                    LIMIT 1
                    """
                )
            ).scalar()
            if transactions_exists:
                tx_hash_unique_index_exists = connection.execute(
                    text(
                        """
                        SELECT 1
                        FROM pg_indexes
                        WHERE schemaname = 'public'
                          AND tablename = 'transactions'
                          AND indexdef ILIKE 'CREATE UNIQUE INDEX% (tx_hash%'
                        LIMIT 1
                        """
                    )
                ).scalar()

                if not tx_hash_unique_index_exists:
                    duplicate_tx_hash = connection.execute(
                        text(
                            """
                            SELECT tx_hash
                            FROM transactions
                            WHERE tx_hash IS NOT NULL
                            GROUP BY tx_hash
                            HAVING COUNT(*) > 1
                            LIMIT 1
                            """
                        )
                    ).scalar()

                    if duplicate_tx_hash:
                        logger.warning(
                            "Schema precondition skipped: duplicate transactions.tx_hash found; "
                            "cannot create unique index required for FK tables"
                        )
                    else:
                        logger.warning(
                            "Skipping transactions.tx_hash unique index migration on legacy/partitioned schema"
                        )

            status_exists = connection.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'transactions'
                      AND column_name = 'status'
                    LIMIT 1
                    """
                )
            ).scalar()

            if not status_exists:
                logger.warning("Applying schema fix: adding transactions.status")
                connection.execute(text("ALTER TABLE transactions ADD COLUMN status SMALLINT DEFAULT 1"))

            tx_risk_exists = connection.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'transactions'
                      AND column_name = 'normalized_risk_score'
                    LIMIT 1
                    """
                )
            ).scalar()
            if not tx_risk_exists:
                logger.warning("Applying schema fix: adding transactions.normalized_risk_score")
                connection.execute(text("ALTER TABLE transactions ADD COLUMN normalized_risk_score NUMERIC(3,2)"))

            tx_case_status_exists = connection.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'transactions'
                      AND column_name = 'case_status'
                    LIMIT 1
                    """
                )
            ).scalar()
            if not tx_case_status_exists:
                logger.warning("Applying schema fix: adding transactions.case_status")
                connection.execute(text("ALTER TABLE transactions ADD COLUMN case_status VARCHAR(20) DEFAULT 'PENDING'"))

            tx_assigned_to_exists = connection.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'transactions'
                      AND column_name = 'assigned_to'
                    LIMIT 1
                    """
                )
            ).scalar()
            if not tx_assigned_to_exists:
                logger.warning("Applying schema fix: adding transactions.assigned_to")
                connection.execute(text("ALTER TABLE transactions ADD COLUMN assigned_to UUID"))

            tx_updated_at_exists = connection.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'transactions'
                      AND column_name = 'updated_at'
                    LIMIT 1
                    """
                )
            ).scalar()
            if not tx_updated_at_exists:
                logger.warning("Applying schema fix: adding transactions.updated_at")
                connection.execute(text("ALTER TABLE transactions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW()"))

            # Case-management constraints and indexes
            connection.execute(
                text(
                    """
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_constraint
                            WHERE conname = 'ck_transactions_normalized_risk_score'
                        ) THEN
                            ALTER TABLE transactions
                            ADD CONSTRAINT ck_transactions_normalized_risk_score
                            CHECK (
                                normalized_risk_score IS NULL
                                OR (normalized_risk_score >= 0 AND normalized_risk_score <= 1)
                            );
                        END IF;
                    END $$;
                    """
                )
            )

            connection.execute(
                text(
                    """
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_constraint
                            WHERE conname = 'ck_transactions_case_status'
                        ) THEN
                            ALTER TABLE transactions
                            ADD CONSTRAINT ck_transactions_case_status
                            CHECK (case_status IN ('PENDING', 'VERIFIED', 'FRAUD', 'IGNORED'));
                        END IF;
                    END $$;
                    """
                )
            )

            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_transactions_case_status ON transactions (case_status)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_transactions_assigned_to ON transactions (assigned_to)"))

            # alerts.metadata
            alerts_metadata_exists = connection.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'alerts'
                      AND column_name = 'metadata'
                    LIMIT 1
                    """
                )
            ).scalar()
            if not alerts_metadata_exists:
                logger.warning("Applying schema fix: adding alerts.metadata")
                connection.execute(text("ALTER TABLE alerts ADD COLUMN metadata JSONB"))

            # alerts.acknowledged type
            ack_type = connection.execute(
                text(
                    """
                    SELECT data_type
                    FROM information_schema.columns
                    WHERE table_name = 'alerts'
                      AND column_name = 'acknowledged'
                    LIMIT 1
                    """
                )
            ).scalar()
            if ack_type and str(ack_type).lower() != 'boolean':
                logger.warning("Applying schema fix: converting alerts.acknowledged to BOOLEAN")
                connection.execute(
                    text(
                        """
                        ALTER TABLE alerts
                        ALTER COLUMN acknowledged TYPE BOOLEAN
                        USING (acknowledged::boolean)
                        """
                    )
                )

            # alerts.acknowledged_at + alerts.acknowledged_by
            ack_at_exists = connection.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'alerts'
                      AND column_name = 'acknowledged_at'
                    LIMIT 1
                    """
                )
            ).scalar()
            if not ack_at_exists:
                logger.warning("Applying schema fix: adding alerts.acknowledged_at")
                connection.execute(text("ALTER TABLE alerts ADD COLUMN acknowledged_at TIMESTAMPTZ"))

            ack_by_exists = connection.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'alerts'
                      AND column_name = 'acknowledged_by'
                    LIMIT 1
                    """
                )
            ).scalar()
            if not ack_by_exists:
                logger.warning("Applying schema fix: adding alerts.acknowledged_by")
                connection.execute(text("ALTER TABLE alerts ADD COLUMN acknowledged_by VARCHAR(255)"))

            # blacklist.severity + blacklist.is_active
            blacklist_severity_exists = connection.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'blacklist'
                      AND column_name = 'severity'
                    LIMIT 1
                    """
                )
            ).scalar()
            if not blacklist_severity_exists:
                logger.warning("Applying schema fix: adding blacklist.severity")
                connection.execute(text("ALTER TABLE blacklist ADD COLUMN severity VARCHAR(20) DEFAULT 'HIGH'"))

            blacklist_active_exists = connection.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'blacklist'
                      AND column_name = 'is_active'
                    LIMIT 1
                    """
                )
            ).scalar()
            if not blacklist_active_exists:
                logger.warning("Applying schema fix: adding blacklist.is_active")
                connection.execute(text("ALTER TABLE blacklist ADD COLUMN is_active BOOLEAN DEFAULT true"))

            blacklist_verified_exists = connection.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'blacklist'
                      AND column_name = 'verified_at'
                    LIMIT 1
                    """
                )
            ).scalar()
            if not blacklist_verified_exists:
                logger.warning("Applying schema fix: adding blacklist.verified_at")
                connection.execute(text("ALTER TABLE blacklist ADD COLUMN verified_at TIMESTAMPTZ"))

            blacklist_expires_exists = connection.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'blacklist'
                      AND column_name = 'expires_at'
                    LIMIT 1
                    """
                )
            ).scalar()
            if not blacklist_expires_exists:
                logger.warning("Applying schema fix: adding blacklist.expires_at")
                connection.execute(text("ALTER TABLE blacklist ADD COLUMN expires_at TIMESTAMPTZ"))

            # notification_events: keep backward compatibility with old schema variants
            notification_severity_exists = connection.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'notification_events'
                      AND column_name = 'severity'
                    LIMIT 1
                    """
                )
            ).scalar()
            if not notification_severity_exists:
                logger.warning("Applying schema fix: adding notification_events.severity")
                connection.execute(
                    text("ALTER TABLE notification_events ADD COLUMN severity VARCHAR(20) DEFAULT 'MEDIUM'")
                )
            connection.execute(text("CREATE INDEX IF NOT EXISTS idx_notification_events_severity ON notification_events (severity)"))

            # Old deployments may have event_type NOT NULL, while ORM does not provide it.
            notification_event_type_exists = connection.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'notification_events'
                      AND column_name = 'event_type'
                    LIMIT 1
                    """
                )
            ).scalar()
            if notification_event_type_exists:
                logger.warning("Applying schema fix: relaxing notification_events.event_type")
                connection.execute(
                    text(
                        """
                        ALTER TABLE notification_events
                        ALTER COLUMN event_type DROP NOT NULL,
                        ALTER COLUMN event_type SET DEFAULT 'GENERIC'
                        """
                    )
                )

            notification_message_nullable = connection.execute(
                text(
                    """
                    SELECT is_nullable
                    FROM information_schema.columns
                    WHERE table_name = 'notification_events'
                      AND column_name = 'message'
                    LIMIT 1
                    """
                )
            ).scalar()
            if notification_message_nullable == 'YES':
                connection.execute(text("UPDATE notification_events SET message = '' WHERE message IS NULL"))
                connection.execute(
                    text("ALTER TABLE notification_events ALTER COLUMN message SET NOT NULL")
                )

            notification_recipient_nullable = connection.execute(
                text(
                    """
                    SELECT is_nullable
                    FROM information_schema.columns
                    WHERE table_name = 'notification_events'
                      AND column_name = 'recipient'
                    LIMIT 1
                    """
                )
            ).scalar()
            if notification_recipient_nullable == 'YES':
                connection.execute(text("UPDATE notification_events SET recipient = 'system' WHERE recipient IS NULL"))
                connection.execute(
                    text("ALTER TABLE notification_events ALTER COLUMN recipient SET NOT NULL")
                )
    except Exception as schema_error:
        # Don't hard-fail startup on best-effort migration.
        logger.error(f"Schema ensure failed: {schema_error}")


def get_db() -> Generator[Session, None, None]:
    """
    Dependency that provides database session to route handlers.

    Yields:
        SQLAlchemy database session that auto-closes after use
    """
    database_session = SessionLocal()
    try:
        yield database_session
    except Exception as db_error:
        logger.error(f"Database session error: {db_error}")
        database_session.rollback()
        raise
    finally:
        database_session.close()
