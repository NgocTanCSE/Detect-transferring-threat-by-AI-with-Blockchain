"""Best-effort database bootstrap for Hugging Face Space startup.

This script initializes a fresh Supabase database from the repository SQL files.
It is intentionally idempotent enough for startup use:
- If the `users` table does not exist, run the full schema + demo seed.
- If the schema exists but there are no users yet, run the rich demo seed.
- Otherwise, skip.
"""

from __future__ import annotations

import logging
from pathlib import Path

import psycopg2

from app.core.config import DATABASE_URL


logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).resolve().parent.parent
DATABASE_DIR = ROOT_DIR / "database"
INIT_SQL_PATH = DATABASE_DIR / "init.sql"
SEED_SQL_PATH = DATABASE_DIR / "seed_rich_demo.sql"


def _table_exists(cur, table_name: str) -> bool:
    cur.execute(
        """
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = %s
        LIMIT 1
        """,
        (table_name,),
    )
    return cur.fetchone() is not None


def _scalar_count(cur, query: str) -> int:
    cur.execute(query)
    result = cur.fetchone()
    return int(result[0] if result and result[0] is not None else 0)


def _execute_sql_file(cur, file_path: Path) -> None:
    if not file_path.exists():
        raise FileNotFoundError(f"Missing SQL bootstrap file: {file_path}")

    logger.info("Running SQL file: %s", file_path.name)
    with file_path.open("r", encoding="utf-8") as handle:
        cur.execute(handle.read())


def _ensure_wallet_id_default(cur) -> None:
    """Ensure wallets.id can be auto-generated on schema variants created outside init.sql."""
    if not _table_exists(cur, "wallets"):
        return

    cur.execute(
        """
        SELECT data_type, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'wallets'
          AND column_name = 'id'
        LIMIT 1
        """
    )
    result = cur.fetchone()
    if not result:
        return

    data_type, column_default = result
    if data_type != "uuid":
        logger.warning("wallets.id is not UUID (found: %s); skipping default migration", data_type)
        return

    if column_default:
        return

    logger.info("wallets.id has no server default; applying uuid_generate_v4() default")
    cur.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    cur.execute("ALTER TABLE public.wallets ALTER COLUMN id SET DEFAULT uuid_generate_v4()")


def bootstrap_database() -> None:
    if not DATABASE_URL:
        logger.info("DATABASE_URL is not set; skipping bootstrap")
        return

    if not DATABASE_URL.startswith(("postgresql://", "postgres://")):
        logger.info("Non-Postgres DATABASE_URL detected; skipping Supabase bootstrap")
        return

    connection = psycopg2.connect(DATABASE_URL)
    connection.autocommit = False

    try:
        with connection.cursor() as cur:
            _ensure_wallet_id_default(cur)
            users_table_exists = _table_exists(cur, "users")
            users_count = _scalar_count(cur, "SELECT COUNT(*) FROM users") if users_table_exists else 0

            if not users_table_exists:
                logger.info("No users table found; bootstrapping schema and demo data")
                _execute_sql_file(cur, INIT_SQL_PATH)
                _execute_sql_file(cur, SEED_SQL_PATH)
                connection.commit()
                logger.info("Database bootstrap completed from scratch")
                return

            if users_count == 0:
                logger.info("Users table exists but is empty; loading rich demo data")
                _execute_sql_file(cur, SEED_SQL_PATH)
                connection.commit()
                logger.info("Demo data import completed")
                return

            logger.info("Database already contains user data; skipping bootstrap")
            connection.commit()
    except Exception:
        connection.rollback()
        logger.exception("Database bootstrap failed")
        raise
    finally:
        connection.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
    bootstrap_database()
