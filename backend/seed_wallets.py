"""
Seed script to populate test wallets with actual ETH balances.
Run this after database initialization.

Usage: python seed_wallets.py
"""
import os
import uuid
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.core.database import Base
from app.models.models import Wallet, Transaction, Blacklist

# Get database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/blockchain_ai"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_wallets():
    """Seed test wallets with real transactions."""
    db = SessionLocal()

    try:
        # Create test wallets
        test_wallets = [
            {
                "id": uuid.UUID("550e8400-e29b-41d4-a716-446655440001"),
                "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD08",
                "label": "Alice User Account",
                "entity_type": "User",
                "account_status": "active",
                "risk_score": 15.5,
                "risk_category": None,
                "total_transactions": 5,
                "total_value_sent": int(1e18),  # 1 ETH
                "total_value_received": int(11e18),  # 11 ETH
                "first_seen_at": datetime.utcnow() - timedelta(days=30),
                "last_activity_at": datetime.utcnow() - timedelta(days=1),
            },
            {
                "id": uuid.UUID("550e8400-e29b-41d4-a716-446655440002"),
                "address": "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
                "label": "Bob Suspected Account",
                "entity_type": "User",
                "account_status": "active",
                "risk_score": 62.3,
                "risk_category": "manipulation",
                "total_transactions": 12,
                "total_value_sent": int(3.5e18),  # 3.5 ETH
                "total_value_received": int(5.2e18),  # 5.2 ETH
                "first_seen_at": datetime.utcnow() - timedelta(days=60),
                "last_activity_at": datetime.utcnow() - timedelta(days=2),
            },
            {
                "id": uuid.UUID("550e8400-e29b-41d4-a716-446655440003"),
                "address": "0x9f8c5e6F5e6E1e1E1e1e1e1e1e1e1e1e1e1e1e1e",
                "label": "Charlie Trading Account",
                "entity_type": "User",
                "account_status": "active",
                "risk_score": 28.7,
                "risk_category": None,
                "total_transactions": 22,
                "total_value_sent": int(8.5e18),  # 8.5 ETH
                "total_value_received": int(15e18),  # 15 ETH
                "first_seen_at": datetime.utcnow() - timedelta(days=90),
                "last_activity_at": datetime.utcnow() - timedelta(hours=4),
            },
            {
                "id": uuid.UUID("550e8400-e29b-41d4-a716-446655440004"),
                "address": "0xDead1000000000000000000000000000000Dead",
                "label": "Scam Wallet",
                "entity_type": "Unknown",
                "account_status": "frozen",
                "risk_score": 99.8,
                "risk_category": "scam",
                "total_transactions": 145,
                "total_value_sent": int(95e18),  # 95 ETH
                "total_value_received": int(2e18),  # 2 ETH
                "first_seen_at": datetime.utcnow() - timedelta(days=200),
                "last_activity_at": datetime.utcnow() - timedelta(days=7),
            },
        ]

        # Insert wallets
        for wallet_data in test_wallets:
            existing = db.query(Wallet).filter(Wallet.address == wallet_data["address"]).first()
            if not existing:
                wallet = Wallet(**wallet_data)
                db.add(wallet)
                print(f"✓ Created wallet: {wallet_data['label']} ({wallet_data['address'][:10]}...)")
            else:
                print(f"⊘ Wallet already exists: {wallet_data['label']}")

        db.commit()

        # Create transactions
        test_transactions = [
            # Genesis: 10 ETH to Alice
            {
                "id": uuid.UUID("650e8400-e29b-41d4-a716-446655440001"),
                "tx_hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                "block_number": 18000000,
                "timestamp": datetime.utcnow() - timedelta(days=30),
                "from_address": "0x0000000000000000000000000000000000000000",
                "to_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD08",
                "value": int(10e18),
                "gas_price": 20000000000,
                "gas_used": 21000,
                "input_data": "0x",
                "status": 1,
            },
            # Alice sends 1 ETH to Bob
            {
                "id": uuid.UUID("650e8400-e29b-41d4-a716-446655440002"),
                "tx_hash": "0x2234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                "block_number": 18000100,
                "timestamp": datetime.utcnow() - timedelta(days=29),
                "from_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD08",
                "to_address": "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
                "value": int(1e18),
                "gas_price": 20000000000,
                "gas_used": 21000,
                "input_data": "0x",
                "status": 1,
            },
            # Genesis: 5.2 ETH to Bob
            {
                "id": uuid.UUID("650e8400-e29b-41d4-a716-446655440003"),
                "tx_hash": "0x3234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                "block_number": 18000200,
                "timestamp": datetime.utcnow() - timedelta(days=28),
                "from_address": "0x0000000000000000000000000000000000000000",
                "to_address": "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
                "value": int(5.2e18),
                "gas_price": 20000000000,
                "gas_used": 21000,
                "input_data": "0x",
                "status": 1,
            },
            # Genesis: 15 ETH to Charlie
            {
                "id": uuid.UUID("650e8400-e29b-41d4-a716-446655440004"),
                "tx_hash": "0x4234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                "block_number": 18000300,
                "timestamp": datetime.utcnow() - timedelta(days=90),
                "from_address": "0x0000000000000000000000000000000000000000",
                "to_address": "0x9f8c5e6F5e6E1e1E1e1e1e1e1e1e1e1e1e1e1e1e",
                "value": int(15e18),
                "gas_price": 20000000000,
                "gas_used": 21000,
                "input_data": "0x",
                "status": 1,
            },
            # Bob sends 3.5 ETH to Charlie
            {
                "id": uuid.UUID("650e8400-e29b-41d4-a716-446655440005"),
                "tx_hash": "0x5234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                "block_number": 18000400,
                "timestamp": datetime.utcnow() - timedelta(days=60),
                "from_address": "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
                "to_address": "0x9f8c5e6F5e6E1e1E1e1e1e1e1e1e1e1e1e1e1e1e",
                "value": int(3.5e18),
                "gas_price": 20000000000,
                "gas_used": 21000,
                "input_data": "0x",
                "status": 1,
            },
        ]

        # Insert transactions
        for tx_data in test_transactions:
            existing = db.query(Transaction).filter(Transaction.tx_hash == tx_data["tx_hash"]).first()
            if not existing:
                tx = Transaction(**tx_data)
                db.add(tx)
                print(f"✓ Created transaction: {tx_data['tx_hash'][:20]}... ({tx_data['value']/1e18} ETH)")
            else:
                print(f"⊘ Transaction already exists: {tx_data['tx_hash'][:20]}...")

        db.commit()

        # Add blacklist entry for scam wallet
        existing_blacklist = db.query(Blacklist).filter(
            Blacklist.address == "0xDead1000000000000000000000000000000Dead"
        ).first()

        if not existing_blacklist:
            blacklist = Blacklist(
                address="0xDead1000000000000000000000000000000Dead",
                category="scam",
                source="Internal Detection",
                severity="CRITICAL",
                is_active=True,
                reported_at=datetime.utcnow()
            )
            db.add(blacklist)
            db.commit()
            print("✓ Added blacklist entry for scam wallet")
        else:
            print("⊘ Blacklist entry already exists")

        # Print summary
        print("\n" + "="*60)
        print("WALLET BALANCES SUMMARY")
        print("="*60)

        for wallet_data in test_wallets:
            received = wallet_data["total_value_received"]
            sent = wallet_data["total_value_sent"]
            balance = received - sent
            balance_eth = balance / 1e18

            print(f"\n{wallet_data['label']}")
            print(f"  Address: {wallet_data['address']}")
            print(f"  Status: {wallet_data['account_status']}")
            print(f"  Risk Score: {wallet_data['risk_score']}")
            print(f"  Received: {received/1e18:.4f} ETH")
            print(f"  Sent: {sent/1e18:.4f} ETH")
            print(f"  Balance: {balance_eth:.4f} ETH")

        print("\n" + "="*60)
        print("✓ Seed completed successfully!")
        print("="*60)

    except Exception as e:
        print(f"✗ Error during seeding: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_wallets()
