import bcrypt
import psycopg2

DATABASE_URL = "postgresql://blockchain:blockchain123@localhost:5432/blockchain_main"

def hash_passwords():
    print("Hashing legacy passwords...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    try:
        cur.execute("SELECT id, username, password_hash FROM users")
        users = cur.fetchall()
        
        for user_id, username, raw_pass in users:
            # Check if already hashed (bcrypt hashes start with $2b$ or $2a$)
            if raw_pass.startswith('$2b$') or raw_pass.startswith('$2a$'):
                print(f"  Skipping {username}, already hashed.")
                continue
            
            hashed = bcrypt.hashpw(raw_pass.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (hashed, user_id))
            print(f"  Hashed password for {username}")
            
        conn.commit()
    except Exception as e:
        print(f"Error hashing: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    hash_passwords()
