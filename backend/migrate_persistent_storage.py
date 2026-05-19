"""
Persistent Storage Migration Tool
Checks where data is stored and helps migrate to /data bucket
"""

import os
import shutil
from pathlib import Path
from datetime import datetime


def find_databases():
    """Find all blockchain database files in the system."""
    search_paths = [
        Path.cwd() / "blockchain_local.db",
        Path("/tmp") / "blockchain_local.db",
        Path("/app/backend") / "blockchain_local.db",
        Path("/data") / "blockchain_local.db",
    ]

    found = {}
    for path in search_paths:
        if path.exists():
            size = path.stat().st_size / (1024 * 1024)  # MB
            found[str(path)] = {
                "exists": True,
                "size_mb": round(size, 2),
                "persistent": "/data" in str(path)
            }

    return found


def migrate_to_persistent():
    """Migrate all found databases to /data bucket."""
    databases = find_databases()

    print("\n" + "=" * 60)
    print("DATABASE STORAGE AUDIT & MIGRATION")
    print("=" * 60)

    if not databases:
        print("\n❌ No database files found!")
        print("   Run seed_wallets.py to create fresh database at /data")
        return

    print("\n📍 Current database locations:")
    for path, info in databases.items():
        persistent = "✓ PERSISTENT" if info["persistent"] else "⚠ TEMPORARY"
        print(f"   [{persistent}] {path} ({info['size_mb']} MB)")

    # Identify target location
    new_path = Path("/data/blockchain_local.db")
    new_path.parent.mkdir(parents=True, exist_ok=True)

    # Move all non-/data databases to /data
    migrated = 0
    for path_str, info in databases.items():
        path = Path(path_str)
        if not info["persistent"]:
            backup_path = path.with_suffix(f".backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}.db")
            print(f"\n   Moving {path}...")
            print(f"   → Backup: {backup_path}")
            shutil.copy2(path, backup_path)
            shutil.move(path, new_path)
            migrated += 1
            print(f"   ✓ Moved to persistent storage")

    if migrated == 0:
        print("\n✓ Database already in persistent storage at /data")
    else:
        print(f"\n✓ {migrated} database(s) migrated to /data")

    print(f"\n📍 Final location: {new_path}")
    print("   This location persists across HF Spaces restarts\n")

    # Show reset instructions
    print("=" * 60)
    print("RESET DATA (if needed)")
    print("=" * 60)
    print("\nTo clear all data and start fresh:")
    print(f"   1. Delete: rm {new_path}")
    print("   2. Rebuild the Space")
    print("   3. seed_wallets.py will create fresh 5000-user dataset\n")


if __name__ == "__main__":
    migrate_to_persistent()
