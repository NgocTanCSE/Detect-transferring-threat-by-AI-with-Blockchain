import psycopg2
import os
import random
from datetime import datetime, timedelta

def seed_main():
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://blockchain:blockchain123@postgres_main:5432/blockchain_main")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    print("Seeding Main Database (Wallets, Transfers)...")

    # Clear existing data
    # cur.execute("TRUNCATE wallets, transactions, blocked_transfers RESTART IDENTITY CASCADE")

    wallets = [
        ('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', 'active', 15.5, 12),
        ('0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD', 'active', 85.0, 45),
        ('0x1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t', 'suspended', 98.2, 5),
        ('0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', 'active', 45.0, 20),
        ('0x8888888888888888888888888888888888888888', 'active', 5.0, 100)
    ]

    for addr, status, score, txs in wallets:
        cur.execute(
            "INSERT INTO wallets (address, account_status, risk_score, total_transactions, created_at) VALUES (%s, %s, %s, %s, NOW()) ON CONFLICT (address) DO UPDATE SET risk_score = %s",
            (addr.lower(), status, score, txs, score)
        )

    # Seed blocked transfers
    for i in range(10):
        cur.execute(
            "INSERT INTO blocked_transfers (sender_address, receiver_address, amount, risk_score, reason, blocked_at) VALUES (%s, %s, %s, %s, %s, %s)",
            (wallets[1][0], wallets[2][0], random.uniform(0.1, 5.0), random.uniform(80, 100), "High risk detected by AI", datetime.now() - timedelta(days=random.randint(0, 30)))
        )

    conn.commit()
    cur.close()
    conn.close()

def seed_alerts():
    # Note: postgres_alerts is on a different host in docker-compose
    # But from inside a container, it's 'postgres_alerts'
    DATABASE_URL = "postgresql://blockchain:blockchain123@postgres_alerts:5432/blockchain_alerts"
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        print("Seeding Alerts Database...")

        for i in range(20):
            severity = random.choice(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
            cur.execute(
                "INSERT INTO alerts (wallet_address, risk_score, severity, alert_type, message, detected_at) VALUES (%s, %s, %s, %s, %s, %s)",
                ('0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad', random.uniform(50, 100), severity, 'PHISHING', f'Suspicious activity detected pattern {i}', datetime.now() - timedelta(hours=random.randint(0, 168)))
            )

        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Skipping Alerts seed (maybe DB not ready?): {e}")

if __name__ == "__main__":
    seed_main()
    seed_alerts()
    print("✅ Seeding completed!")
