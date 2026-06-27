"""Initialize demo data and start traffic simulation."""

import subprocess
import time
import os

def main():
    print("=== Initializing Demo Data ===")

    # 1. Seed model registry
    print("Seeding model registry...")
    subprocess.run(["python", "seed_model_registry.py"], cwd="/app/backend", check=False)

    # 2. Seed demo wallets
    print("Seeding demo wallets...")
    subprocess.run(["python", "seed_demo_wallets.py"], cwd="/app/backend", check=False)

    # 3. Start traffic generator
    print("Starting traffic generator...")
    time.sleep(2)
    subprocess.run(["python", "demo-scripts/sim_generate_traffic.py"], cwd="/app/backend")

if __name__ == "__main__":
    main()