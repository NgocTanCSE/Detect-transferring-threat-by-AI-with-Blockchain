import time
import random
import uuid
from datetime import datetime
import psycopg2
from psycopg2.extras import execute_values
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://blockchain:blockchain_pass@postgres_main:5432/blockchain_main")

# Configuration for Money Laundering Simulation
SUSPICIOUS_HUBS = [
    "0x4444444444444444444444444444444444444444", # Mixer Ingress M1
    "0x5555555555555555555555555555555555555555", # Scam Collector S1
    "0x9999999999999999999999999999999999999999"  # Sanctioned Proxy
]

# Generate a pool of "Smurf" accounts (layering accounts)
SMURF_ACCOUNTS = [f"0x{uuid.uuid4().hex[:40]}" for _ in range(50)]

def get_db_connection():
    try:
        return psycopg2.connect(DATABASE_URL)
    except Exception as e:
        print(f"Lỗi kết nối cơ sở dữ liệu: {e}")
        return None

def traffic_worker():
    print("🚀 Đang khởi động Trình tạo lưu lượng mạng NÂNG CAO...")
    print(f"Đang nhắm mục tiêu {len(SUSPICIOUS_HUBS)} trung tâm và {len(SMURF_ACCOUNTS)} tài khoản 'Smurf'.")
    
    conn = get_db_connection()
    if not conn: return

    # Ensure smurf accounts exist in wallets table
    with conn.cursor() as cur:
        for addr in SMURF_ACCOUNTS:
            cur.execute(
                "INSERT INTO wallets (id, address, risk_score, account_status) VALUES (%s, %s, %s, %s) ON CONFLICT (address) DO NOTHING",
                (str(uuid.uuid4()), addr, random.uniform(20, 55), 'active')
            )
        conn.commit()

    while True:
        try:
            with conn.cursor() as cur:
                txs = []
                wallets_to_update = set()

                # 1. Generate Realistic Money Laundering Patterns (Hub -> Smurfs)
                for hub in SUSPICIOUS_HUBS:
                    # Pick 3-5 random smurfs to receive money from this hub
                    targets = random.sample(SMURF_ACCOUNTS, random.randint(3, 5))
                    for target in targets:
                        value = random.uniform(0.1, 2.5) * 10**18
                        tx_hash = f"0x{uuid.uuid4().hex}"
                        timestamp = datetime.now()
                        txs.append((str(uuid.uuid4()), tx_hash, hub, target, str(int(value)), 0, timestamp, 1, 'ethereum'))
                        wallets_to_update.add(hub)
                        wallets_to_update.add(target)

                # 2. Generate Smurf -> Smurf (Layering)
                layering_count = random.randint(5, 10)
                for _ in range(layering_count):
                    s1, s2 = random.sample(SMURF_ACCOUNTS, 2)
                    value = random.uniform(0.01, 0.5) * 10**18
                    tx_hash = f"0x{uuid.uuid4().hex}"
                    txs.append((str(uuid.uuid4()), tx_hash, s1, s2, str(int(value)), 0, datetime.now(), 1, 'ethereum'))
                    wallets_to_update.add(s1)
                    wallets_to_update.add(s2)

                # 3. Generate some random noise (clean traffic)
                for _ in range(10):
                    clean_from = f"0x{uuid.uuid4().hex[:40]}"
                    clean_to = f"0x{uuid.uuid4().hex[:40]}"
                    value = random.uniform(0.001, 0.1) * 10**18
                    txs.append((str(uuid.uuid4()), f"0x{uuid.uuid4().hex}", clean_from, clean_to, str(int(value)), 0, datetime.now(), 1, 'ethereum'))

                # Bulk insert transactions
                execute_values(cur, """
                    INSERT INTO transactions (id, tx_hash, from_address, to_address, value, block_number, timestamp, status, chain_id)
                    VALUES %s
                """, txs)

                # 4. Update Money Flow Snapshots for the live chart
                inflow = sum(float(t[4]) for t in txs) / 10**18
                outflow = inflow * random.uniform(0.7, 0.95)
                cur.execute("""
                    INSERT INTO money_flow_snapshots (id, timestamp, inflow_eth, outflow_eth, chain_id, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (str(uuid.uuid4()), datetime.now(), inflow, outflow, 'ethereum', datetime.now()))

                # 5. Inject some alerts occasionally to keep Alert Queue alive
                if random.random() < 0.3: # 30% chance each burst
                    alert_id = str(uuid.uuid4())
                    wallet = random.choice(SMURF_ACCOUNTS)
                    alert_type = random.choice(['SUSPICIOUS_TRANSFER', 'LARGE_VOLUME', 'MIXER_INTERACTION', 'LAYERING_DETECTED'])
                    severity = random.choice(['MEDIUM', 'HIGH', 'CRITICAL'])
                    score = random.uniform(45, 95)
                    cur.execute("""
                        INSERT INTO alerts (id, wallet_address, alert_type, severity, message, risk_score, chain_id, detected_at, acknowledged)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), false)
                    """, (alert_id, wallet, alert_type, severity, f"Dấu hiệu {alert_type} được phát hiện từ bộ tạo mô phỏng.", score, 'ethereum'))

                # Update wallet activity
                for addr in wallets_to_update:
                    cur.execute("""
                        UPDATE wallets SET 
                            total_transactions = total_transactions + 1,
                            last_activity_at = NOW(),
                            updated_at = NOW()
                        WHERE address = %s
                    """, (addr,))

                conn.commit()
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Đã tiêm {len(txs)} giao dịch (Mẫu mạng). Các trung tâm đang hoạt động.")
                
            time.sleep(2) # Wait 2 seconds between bursts
                
        except Exception as e:
            conn.rollback()
            print(f"Lỗi trong quá trình tạo lưu lượng: {e}")
            time.sleep(5)

if __name__ == "__main__":
    traffic_worker()
