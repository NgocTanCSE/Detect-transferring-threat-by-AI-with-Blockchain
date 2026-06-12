import requests
import time
import random
import string

API_BASE = "http://localhost:8000"
REGISTER_URL = f"{API_BASE}/auth/register"

def generate_random_user():
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return {
        "username": f"bot_user_{suffix}",
        "email": f"spam_{suffix}@mailinator.com",
        "password": "StrongPass123!",
        "wallet_address": "0x" + "".join(random.choices("0123456789abcdef", k=40))
    }

def attempt_registration(user_data, index):
    print(f"[{index}] Registering {user_data['username']}...")
    try:
        response = requests.post(REGISTER_URL, json=user_data, timeout=5)
        if response.status_code == 201:
            print(f"  [OK] SUCCESS: Created")
        elif response.status_code == 429:
            print(f"  [BLOCKED] RATE LIMITED: Too many requests")
        elif response.status_code == 400:
            print(f"  [BLOCKED] SPAM DETECTED: {response.json().get('detail', 'Bad Request')}")
        else:
            print(f"  [FAIL] ({response.status_code}): {response.text}")
    except Exception as e:
        print(f"  [ERROR] Connection failed: {e}")

def run_spam_simulation():
    print("\n" + "=" * 60)
    print("REGISTRATION SPAM SIMULATION")
    print("=" * 60)
    print("Attempting to create accounts rapidly to trigger protection...")
    
    for i in range(10):
        user = generate_random_user()
        attempt_registration(user, i + 1)
        # Small delay to see the logs, but fast enough to trigger rate limiting
        time.sleep(0.5)

    print("\nSimulation complete.")

if __name__ == "__main__":
    run_spam_simulation()
