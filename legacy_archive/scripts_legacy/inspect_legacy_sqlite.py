import sqlite3
import json

def inspect_db():
    conn = sqlite3.connect('backend/test.db')
    cur = conn.cursor()
    
    cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [t[0] for t in cur.fetchall()]
    print(f"Tables: {tables}")
    
    for table in tables:
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        count = cur.fetchone()[0]
        print(f"  {table}: {count} rows")
        
        # Peek at data
        if count > 0:
            cur.execute(f"SELECT * FROM {table} LIMIT 1")
            print(f"    Sample: {cur.fetchone()}")
            
    conn.close()

if __name__ == "__main__":
    inspect_db()
