import requests
import time
import random

API_BASE = "http://localhost:8000"
SEND_URL = f"{API_BASE}/send"

def generate_wallet():
    return "0x" + "".join(random.choices("0123456789abcdef", k=40))

def send_transaction(sender: str, receiver: str, amount: float, label: str = ""):
    print(f"[{label}] Sending {amount} ETH from Victim {sender[:8]}... -> SCAMMER {receiver[:8]}...")
    try:
        response = requests.post(
            SEND_URL,
            json={"sender": sender, "receiver": receiver, "amount": amount},
            timeout=5
        )
        if response.status_code == 200:
            print(f"  [OK] SUCCESS")
        elif response.status_code == 403:
            print(f"  [BLOCKED] ANTI-SCAM TRIGGERED: {response.json().get('detail', '')}")
        else:
            print(f"  [FAIL] ({response.status_code})")
    except Exception as e:
        print(f"  [ERROR] {e}")

def simulate_phishing_attack():
    print("\n" + "=" * 60)
    print("PHISHING/SCAM ATTACK SIMULATION (WALLET DRAINER)")
    print("=" * 60)
    
    scammer_wallet = generate_wallet()
    # Use funded wallets as victims
    victims = [
        "0x1111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222",
        "0x5ec6c1131fb3a7613c4af62ec6acc2f35094a25b"
    ]
    
    print(f"Scammer Destination: {scammer_wallet}")
    print(f"Number of victims: {len(victims)}\n")
    
    print("--- STARTING DRAINER ATTACK ---")
    for i, victim in enumerate(victims):
        # Victims sending funds to the same scammer in a short burst
        amount = round(random.uniform(0.1, 2.5), 2)
        send_transaction(victim, scammer_wallet, amount, f"Attack {i+1}")
        time.sleep(0.3) # Very high frequency

    print("\nPhishing simulation complete.")
    print("Check Admin Dashboard for 'Wallet Drainer Pattern' or 'Scam' alerts.")

if __name__ == "__main__":
    simulate_phishing_attack()
