"""Database connection and session management."""

import logging
from typing import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base, Session

from app.core.config import DATABASE_URL

logger = logging.getLogger(__name__)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
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
    try:
        with engine.begin() as connection:
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
