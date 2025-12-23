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
