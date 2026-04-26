import psycopg2
import bcrypt

DB_URL = "postgresql://blockchain:blockchain123@localhost:5432/blockchain_main"

def fast_hash():
    print("Starting FAST password hashing (Admin/Analyst only)...")
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    # Get Admin/Analyst users with plain passwords
    cur.execute("SELECT id, password_hash FROM users WHERE role IN ('admin', 'analyst') AND password_hash NOT LIKE '$2b$%';")
    users = cur.fetchall()
    print(f"Found {len(users)} users to hash.")
    
    for uid, pwd in users:
        hashed = bcrypt.hashpw(pwd.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (hashed, uid))
        print(f"  Hashed password for user ID {uid}")
        conn.commit()
    
    print("Fast hashing complete!")
    conn.close()

if __name__ == "__main__":
    fast_hash()
