import os
import sys
import uuid
from datetime import datetime, timedelta

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
import sqlalchemy as sa
from app.models.models import User

def _eth(val: float) -> str:
    return str(int(val * 10**18))

def run():
    session = SessionLocal()
    now = datetime.utcnow()
    
    test_usernames = ["admin", "analyst", "user"]
    for i, username in enumerate(test_usernames):
        user = session.query(User).filter(User.username == username).first()
        if not user:
            print(f"Skipping {username}, user not found.")
            continue
            
        wallet_address = user.wallet_address
        role = user.role
        
        virtual_eth = 50.0
        if role == "admin":
            virtual_eth = 5000.0
        elif role == "analyst":
            virtual_eth = 200.0
            
        tx_hash = f"0xfund{uuid.uuid4().hex[:58]}"[:66]
        
        # Raw SQL insert
        session.execute(sa.text("""
            INSERT INTO transactions (id, tx_hash, from_address, to_address, value, block_number, timestamp, gas_price, gas_used, input_data, status, case_status, created_at, is_flagged)
            VALUES (:id, :tx_hash, :from_address, :to_address, :value, :block_number, :timestamp, :gas_price, :gas_used, :input_data, :status, :case_status, :created_at, :is_flagged)
        """), {
            "id": str(uuid.uuid4()),
            "tx_hash": tx_hash,
            "from_address": "0x0000000000000000000000000000000000000000",
            "to_address": wallet_address,
            "value": _eth(virtual_eth),
            "block_number": 1000000 + (hash(username) % 1000),
            "timestamp": now - timedelta(days=5),
            "gas_price": _eth(0.00000002),
            "gas_used": 21000,
            "input_data": "0x",
            "status": 1,
            "case_status": "VERIFIED",
            "created_at": now - timedelta(days=5),
            "is_flagged": False
        })
        print(f"Funded {username} ({role}) with {virtual_eth} ETH")
        
    session.commit()
    session.close()

if __name__ == "__main__":
    run()
