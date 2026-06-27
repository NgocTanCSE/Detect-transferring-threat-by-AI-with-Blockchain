"""Demo traffic generator that triggers AI detection on Hugging Face Spaces.

Patterns generated:
1. Money Laundering: Hub -> Smurf accounts (suspect source)  
2. Layering: Smurf -> Smurf transfers
3. Clean Traffic: Random normal transactions
"""

import time
import random
import uuid
from datetime import datetime
import requests
import os

API_URL = os.getenv("API_URL", "http://127.0.0.1:8000")

SUSPICIOUS_HUBS = [
    "0x4444444444444444444444444444444444444444",  # Mixer Ingress M1
    "0x5555555555555555555555555555555555555555",  # Scam Collector S1
    "0x9999999999999999999999999999999999999999",  # Sanctioned Proxy
]

SMURF_ACCOUNTS = [f"0x{uuid.uuid4().hex[:40]}" for _ in range(50)]


def generate_ai_analysis_requests():
    """Trigger AI analysis on suspicious addresses to generate detections."""
    # 1. Analyze suspicious hubs (money laundering sources)
    for hub in SUSPICIOUS_HUBS:
        try:
            requests.get(f"{API_URL}/analyze/{hub}", timeout=5)
        except Exception:
            pass

    # 2. Analyze smurf accounts (layering pattern)
    for smurf in random.sample(SMURF_ACCOUNTS, 10):
        try:
            requests.get(f"{API_URL}/analyze/{smurf}", timeout=5)
        except Exception:
            pass


def main():
    print("=== Demo Traffic Generator (HF Mode) ===")
    print(f"Targeting AI detection via {API_URL}/analyze")

    while True:
        try:
            generate_ai_analysis_requests()
            print(f"[{datetime.now().strftime('%H:%M:%S')}] AI analysis requests sent")
        except Exception as e:
            print(f"Traffic generation error: {e}")
        time.sleep(3)


if __name__ == "__main__":
    main()