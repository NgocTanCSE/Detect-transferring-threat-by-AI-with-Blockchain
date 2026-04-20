import requests
import time
import random
import uuid

API_BASE = "http://localhost:8000"
SEND_URL = f"{API_BASE}/send"


def generate_wallet():
    return "0x" + "".join(random.choices("0123456789abcdef", k=40))


def send_transaction(sender: str, receiver: str, amount: float, label: str = ""):
    print(f"[{label}] Sending {amount} ETH from {sender[:10]}... to {receiver[:10]}...")
    try:
        response = requests.post(
            SEND_URL,
            json={"sender": sender, "receiver": receiver, "amount": amount},
            timeout=5
        )
        if response.status_code == 200:
            print(f"  [OK] SUCCESS: {response.json().get('message', 'ok')}")
        elif response.status_code == 403:
            print(f"  [BLOCKED] FORBIDDEN: {response.json().get('detail', '')}")
        else:
            print(f"  [FAIL] ({response.status_code}): {response.text}")
    except Exception as e:
        print(f"  [ERROR] NETWORK ERROR: {e}")


def simulate_smurfing():
    """
    Simulate Smurfing / Structuring
    1 Big source transfers smaller chunks to N intermediary wallets.
    Those intermediary wallets then forward to 1 Destination wallet.
    """
    print("\n" + "=" * 60)
    print("MONEY LAUNDERING SIMULATION: SMURFING & STRUCTURING")
    print("=" * 60)

    source_wallet = "0x1111111111111111111111111111111111111111" # Admin wallet with funds
    destination_wallet = generate_wallet()
    intermediary_wallets = [generate_wallet() for _ in range(5)]

    print(f"Source Wallet (Dirty): {source_wallet}")
    print(f"Destination Wallet (Clean): {destination_wallet}")
    print(f"Intermediary Wallets (Mules): {len(intermediary_wallets)}\n")

    # Phase 1: Smurfing
    print("--- PHASE 1: DISTRIBUTING FUNDS TO MULES (SMURFING) ---")
    chunck_amount = 9.5  # Just under 10 ETH to avoid some static rules
    for mule in intermediary_wallets:
        send_transaction(source_wallet, mule, chunck_amount, "Phase 1")
        time.sleep(0.5)

    print("\n--- PHASE 2: COLLECTING FUNDS TO DESTINATION (LAYERING/INTEGRATION) ---")
    for mule in intermediary_wallets:
        send_transaction(mule, destination_wallet, chunck_amount - 0.1, "Phase 2")
        time.sleep(0.5)
        
    print("\nMoney laundering simulation completed.\nCheck Dashboard to see if Source/Destination labels are updated.")


if __name__ == "__main__":
    # Check if backend is alive
    try:
        requests.get(f"{API_BASE}/docs", timeout=2)
    except:
        print(f"Lỗi: Không thể kết nối tới {API_BASE}. Hãy chắc chắn bạn đã start backend FastAPI.")
        exit(1)

    simulate_smurfing()
