import os
import sys
import importlib

# Add backend to path so we can import from app
sys.path.append(os.path.abspath('backend'))

# Configuration for the 3 databases (use localhost as we are running from host)
DB_CONFIGS = {
    "main": "postgresql://blockchain:blockchain123@localhost:5432/blockchain_main",
    "alerts": "postgresql://blockchain:blockchain123@localhost:5433/blockchain_alerts",
    "transfers": "postgresql://blockchain:blockchain123@localhost:5434/blockchain_transfers",
}

def run_split_seed():
    print("Starting LARGE Split Seeding...")
    
    # Set high volume for the seed
    os.environ["LOCAL_DEMO_USER_COUNT"] = "5000"
    os.environ["LOCAL_DEMO_TX_PER_USER"] = "5"
    os.environ["LOCAL_DEMO_ALERT_COUNT"] = "500"
    os.environ["LOCAL_DEMO_BLOCKED_COUNT"] = "300"
    os.environ["LOCAL_DEMO_CASE_COUNT"] = "400"

    for name, url in DB_CONFIGS.items():
        print(f"\n--- Seeding {name} DB: {url} ---")
        
        # MUST set env BEFORE reloading config
        os.environ["DATABASE_URL"] = url
        
        # Force reload config and database modules to pick up new DATABASE_URL
        import app.core.config
        importlib.reload(app.core.config)
        import app.core.database
        importlib.reload(app.core.database)
        
        # Now import seed_wallets which depends on them
        import seed_wallets
        importlib.reload(seed_wallets)
        
        try:
            seed_wallets.seed_wallets()
            print(f"Finished seeding {name} DB")
        except Exception as e:
            # We expect some errors because not all tables are in all DBs
            print(f"Seeding {name} DB had some issues (expected for split DB): {str(e)[:100]}...")

if __name__ == "__main__":
    run_split_seed()
