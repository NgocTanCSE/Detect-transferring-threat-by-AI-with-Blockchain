import logging
from app.core.database import ensure_schema, engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate():
    print("Starting database migration (ensure_schema)...")
    try:
        ensure_schema()
        print("Database migration completed successfully.")
    except Exception as e:
        print(f"Error during migration: {e}")

if __name__ == "__main__":
    migrate()
