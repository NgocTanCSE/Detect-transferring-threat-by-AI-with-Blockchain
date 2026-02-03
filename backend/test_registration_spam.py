"""
Test script to verify anti-spam protection for registration.

This script tests:
1. Rate limiting (max 3 accounts per IP per hour, 30s interval)
2. Spam account detection (suspicious usernames, disposable emails, fake wallets)

Run with: python test_registration_spam.py
"""

import requests
import time
import random
import string
from concurrent.futures import ThreadPoolExecutor, as_completed

API_BASE = "http://localhost:8000"
REGISTER_URL = f"{API_BASE}/auth/register"


def generate_random_user(spam_type: str = "normal") -> dict:
    """
    Generate user data for registration.

    Args:
        spam_type: "normal", "bot_username", "disposable_email", "fake_wallet", "all_spam"
    """
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))

    base_user = {
        "username": f"user_{suffix}",
        "email": f"test_{suffix}@gmail.com",
        "password": "TestPass123!",
        "wallet_address": f"0x{''.join(random.choices('0123456789abcdef', k=40))}"
    }

    if spam_type == "normal":
        return base_user

    elif spam_type == "bot_username":
        # Patterns that trigger bot detection
        bot_usernames = [
            f"abc{random.randint(100000, 999999)}",     # abc123456 pattern
            f"user{random.randint(10000, 99999)}",      # user12345 pattern
            f"test{random.randint(100, 999)}",          # test123 pattern
            f"qwerty{suffix}",                           # keyboard pattern
            f"asdfgh_{random.randint(10000000, 99999999)}", # word_12345678 pattern
        ]
        base_user["username"] = random.choice(bot_usernames)
        return base_user

    elif spam_type == "disposable_email":
        # Known disposable email domains
        disposable_domains = [
            "tempmail.com", "guerrillamail.com", "mailinator.com",
            "yopmail.com", "10minutemail.com", "throwaway.email"
        ]
        base_user["email"] = f"test_{suffix}@{random.choice(disposable_domains)}"
        return base_user

    elif spam_type == "fake_wallet":
        # Suspicious wallet patterns
        fake_wallets = [
            "0x" + "0" * 40,                    # Null address
            "0x" + "f" * 40,                    # Max address
            "0x" + "ab" * 20,                   # Repeating pattern
            "0x" + "1234" * 10,                 # Repeating pattern
        ]
        base_user["wallet_address"] = random.choice(fake_wallets)
        return base_user

    elif spam_type == "all_spam":
        # Combine multiple spam indicators
        base_user["username"] = f"user{random.randint(100000, 999999)}"
        base_user["email"] = f"spam@mailinator.com"
        base_user["wallet_address"] = "0x" + "0" * 40
        return base_user

    return base_user


def attempt_registration(user_data: dict, test_name: str = "") -> dict:
    """Attempt to register a user and return result."""
    start_time = time.time()
    try:
        response = requests.post(REGISTER_URL, json=user_data, timeout=10)
        elapsed = time.time() - start_time

        return {
            "test": test_name,
            "status_code": response.status_code,
            "success": response.status_code == 201,
            "elapsed": elapsed,
            "username": user_data["username"],
            "email": user_data.get("email", "N/A"),
            "message": response.json().get("detail") if response.status_code != 201 else "OK"
        }
    except requests.exceptions.RequestException as e:
        return {
            "test": test_name,
            "status_code": 0,
            "success": False,
            "elapsed": time.time() - start_time,
            "username": user_data["username"],
            "email": user_data.get("email", "N/A"),
            "message": str(e)
        }


def test_spam_detection():
    """Test spam account detection patterns."""
    print("\n" + "="*60)
    print("TEST: SPAM ACCOUNT DETECTION")
    print("Testing detection of suspicious registration patterns...")
    print("="*60)

    test_cases = [
        ("Normal User", "normal", True),
        ("Bot Username (abc123456)", "bot_username", False),
        ("Disposable Email", "disposable_email", False),
        ("Fake Wallet Address", "fake_wallet", False),
        ("All Spam Indicators", "all_spam", False),
    ]

    results = []
    for test_name, spam_type, should_succeed in test_cases:
        user_data = generate_random_user(spam_type)
        result = attempt_registration(user_data, test_name)
        results.append(result)

        expected = "ALLOW" if should_succeed else "BLOCK"
        actual = "✅ ALLOWED" if result["success"] else f"❌ BLOCKED ({result['status_code']})"
        match = "✓" if result["success"] == should_succeed else "✗ UNEXPECTED"

        print(f"\n  {test_name}:")
        print(f"    Username: {result['username']}")
        print(f"    Email: {result['email']}")
        print(f"    Expected: {expected}")
        print(f"    Result: {actual} {match}")
        if not result["success"]:
            print(f"    Reason: {result['message'][:80]}...")

        # Wait between tests to avoid rate limiting
        time.sleep(1)

    return results


def test_rate_limiting():
    """Test rapid sequential registration (rate limiting)."""
    print("\n" + "="*60)
    print("TEST: RATE LIMITING")
    print("Attempting 6 rapid registrations (limit: 3/hour, 30s interval)...")
    print("="*60)

    results = []
    for i in range(6):
        user_data = generate_random_user("normal")
        result = attempt_registration(user_data, f"Attempt {i+1}")
        results.append(result)

        status = "✅ SUCCESS" if result["success"] else f"❌ BLOCKED ({result['status_code']})"
        print(f"  Attempt {i+1}: {status}")
        if not result["success"]:
            print(f"    Reason: {result['message'][:60]}...")

    successful = sum(1 for r in results if r["success"])
    blocked_429 = sum(1 for r in results if r["status_code"] == 429)

    print(f"\n  Results: {successful}/6 succeeded, {blocked_429} rate-limited (HTTP 429)")
    return results


def test_parallel_attack():
    """Test parallel registration (simulating bot attack)."""
    print("\n" + "="*60)
    print("TEST: PARALLEL BOT ATTACK")
    print("Attempting 10 simultaneous registrations...")
    print("="*60)

    users = [generate_random_user("normal") for _ in range(10)]
    results = []

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(attempt_registration, user, f"Thread {i+1}"): i
                   for i, user in enumerate(users)}

        for future in as_completed(futures):
            result = future.result()
            results.append(result)

            status = "✅" if result["success"] else "❌"
            print(f"  {result['test']}: {status}")

    successful = sum(1 for r in results if r["success"])
    blocked = len(results) - successful

    print(f"\n  Results: {successful}/10 succeeded, {blocked} blocked")
    return results


def main():
    print("="*60)
    print("🔐 ANTI-SPAM REGISTRATION TEST SUITE")
    print("="*60)
    print(f"Target: {REGISTER_URL}")

    # Check if server is running
    try:
        response = requests.get(f"{API_BASE}/", timeout=5)
        print("✅ Server is running\n")
    except requests.exceptions.ConnectionError:
        print("❌ ERROR: Cannot connect to server!")
        print(f"   Make sure the backend is running at {API_BASE}")
        print("   Run: cd backend && uvicorn app.main:app --reload")
        return

    # Run tests
    print("\n" + "="*60)
    print("Running anti-spam tests...")
    print("="*60)

    # Test 1: Spam Detection Patterns
    spam_results = test_spam_detection()

    # Small delay
    print("\n⏳ Waiting 3 seconds...")
    time.sleep(3)

    # Test 2: Rate Limiting
    rate_results = test_rate_limiting()

    # Small delay
    print("\n⏳ Waiting 3 seconds...")
    time.sleep(3)

    # Test 3: Parallel Attack
    parallel_results = test_parallel_attack()

    # Summary
    print("\n" + "="*60)
    print("📊 SUMMARY")
    print("="*60)

    spam_blocked = sum(1 for r in spam_results if not r["success"] and "bot_username" in r["test"] or "disposable" in r["test"].lower() or "fake" in r["test"].lower() or "all spam" in r["test"].lower())

    print(f"""
Detection Rules Tested:
- Bot username patterns (abc123456, user12345, etc.)
- Disposable email domains (mailinator, tempmail, etc.)
- Fake wallet addresses (null, max, repeating patterns)

Rate Limiting:
- Max 3 registrations per IP per hour
- Minimum 30 seconds between registrations

Results:
- Spam detection: {spam_blocked}/4 suspicious accounts blocked
- Rate limiting: {sum(1 for r in rate_results if r['status_code'] == 429)}/6 rate-limited
- Parallel attack: {sum(1 for r in parallel_results if not r['success'])}/10 blocked

If spam accounts are being blocked and rate limiting works, anti-spam is effective! ✅
""")


if __name__ == "__main__":
    main()
