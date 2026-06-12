import re
import os
import shutil

def sanitize():
    clean_path = "database/seed_clean.sql"
    filepath = "database/seed_demo_data.sql"
    if os.path.exists(clean_path):
        print(f"Restoring {filepath} from {clean_path}...")
        shutil.copyfile(clean_path, filepath)
    else:
        print(f"{clean_path} not found. Operating directly on {filepath}...")
    
    print(f"Reading {filepath}...")
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    tables = ["alerts", "blocked_transfers", "user_warnings", "risk_assessments", "feature_store_configs", "model_registry", "policy_rules", "blacklist", "node_endpoints", "notification_events"]

    print("Removing 'id' columns from INSERT statements...")
    for table in tables:
        pattern_col = rf"(INSERT INTO\s+{table}\s*\(\s*)id\s*,\s*"
        content = re.sub(pattern_col, r"\1", content, flags=re.IGNORECASE)

    print("Removing 'uuid_generate_v4()' values from VALUES lists...")
    content = re.sub(r"\(\s*uuid_generate_v4\s*\(\s*\)\s*,\s*", "(", content, flags=re.IGNORECASE)

    print(f"Saving changes back to {filepath}...")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

    print("Sanitization complete!")

if __name__ == "__main__":
    sanitize()
