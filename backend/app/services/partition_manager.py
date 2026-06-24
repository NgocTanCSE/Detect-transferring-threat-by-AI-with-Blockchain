"""Dynamic partition management for PostgreSQL transactions table."""

import logging
import os
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)


def ensure_future_partitions(database_session: Session, months_ahead: int = 6) -> int:
    """Create partitions for the next N months if they don't exist.
    
    Args:
        database_session: SQLAlchemy database session
        months_ahead: Number of months to create partitions for
        
    Returns:
        Number of partitions created
    """
    created = 0
    now = datetime.now(timezone.utc)
    
    for i in range(months_ahead + 1):
        # Calculate partition date
        year = now.year
        month = now.month + i
        while month > 12:
            month -= 12
            year += 1
        
        partition_name = f"transactions_{year}_{month:02d}"
        from_date = f"{year}-{month:02d}-01"
        to_month = month + 1
        to_year = year
        if to_month > 12:
            to_month = 1
            to_year += 1
        to_date = f"{to_year}-{to_month:02d}-01"
        
        try:
            # Check if partition exists
            exists = database_session.execute(
                text(
                    "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = :partition_name"
                ),
                {"partition_name": partition_name}
            ).scalar()
            
            if not exists:
                # Create partition
                database_session.execute(
                    text(
                        f"""
                        CREATE TABLE IF NOT EXISTS {partition_name} PARTITION OF transactions
                        FOR VALUES FROM ('{from_date}') TO ('{to_date}')
                        """
                    )
                )
                database_session.commit()
                logger.info(f"Created partition {partition_name} for {from_date} to {to_date}")
                created += 1
            else:
                logger.debug(f"Partition {partition_name} already exists")
                
        except SQLAlchemyError as e:
            logger.warning(f"Could not create partition {partition_name}: {e}")
            database_session.rollback()
    
    return created


def cleanup_old_partitions(database_session: Session, keep_months: int = 12) -> int:
    """Drop partitions older than the specified number of months.
    
    Args:
        database_session: SQLAlchemy database session
        keep_months: Number of months to keep (older partitions will be dropped)
        
    Returns:
        Number of partitions dropped
    """
    dropped = 0
    now = datetime.now(timezone.utc)
    
    # This is a destructive operation - only enable with caution
    if os.getenv("ALLOW_PARTITION_DROP", "false").lower() != "true":
        logger.info("Partition cleanup disabled (set ALLOW_PARTITION_DROP=true to enable)")
        return 0
    
    try:
        # Find old partitions
        old_partitions = database_session.execute(
            text(
                """
                SELECT tablename 
                FROM pg_tables 
                WHERE schemaname = 'public' 
                AND tablename LIKE 'transactions_%'
                AND tablename < 'transactions_' || :cutoff
                """
            ),
            {"cutoff": f"{now.year - 1}-{now.month:02d}"}
        ).fetchall()
        
        for (partition_name,) in old_partitions:
            database_session.execute(text(f"DROP TABLE IF EXISTS {partition_name}"))
            database_session.commit()
            logger.info(f"Dropped old partition {partition_name}")
            dropped += 1
            
    except SQLAlchemyError as e:
        logger.warning(f"Could not cleanup partitions: {e}")
        database_session.rollback()
    
    return dropped