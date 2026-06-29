import sqlite3
import json
import os

DB_PATH = r"C:\Users\Ngoc Tan\.local\share\mimocode\mimocode.db"
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# 1. Schema
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]
print("=== TABLES ===")
print(tables)

# 2. Recent sessions
print("\n=== RECENT SESSIONS (last 10) ===")
try:
    cur.execute("SELECT * FROM session ORDER BY time_created DESC LIMIT 10")
    cols = [d[0] for d in cur.description]
    print("COLUMNS:", cols)
    for row in cur.fetchall():
        print(row)
except Exception as e:
    print(f"Error: {e}")

# 3. Schema for each table
for t in tables:
    cur.execute(f"SELECT sql FROM sqlite_master WHERE name='{t}'")
    row = cur.fetchone()
    if row:
        print(f"\n--- SCHEMA: {t} ---")
        print(row[0])

conn.close()
