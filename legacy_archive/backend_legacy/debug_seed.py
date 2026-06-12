import sys
import traceback
from seed_wallets import seed_wallets

if __name__ == "__main__":
    try:
        seed_wallets()
        print("SEED_SUCCESS")
    except Exception as e:
        print("SEED_FAILURE")
        print(f"Error: {e}")
        traceback.print_exc()
        sys.exit(1)
