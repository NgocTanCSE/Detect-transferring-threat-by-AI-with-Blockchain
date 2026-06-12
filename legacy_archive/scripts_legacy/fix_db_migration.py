import psycopg2

def fix():
    url = "postgresql://blockchain:blockchain123@localhost:5432/blockchain_main"
    conn = psycopg2.connect(url)
    cur = conn.cursor()
    try:
        # Alter transactions table
        print("Altering transactions table in main DB...")
        cur.execute("ALTER TABLE transactions ALTER COLUMN case_status SET DEFAULT 'PENDING';")
        cur.execute("ALTER TABLE transactions ALTER COLUMN case_status DROP NOT NULL;")
        conn.commit()
        print("Successfully updated case_status default and nullability!")
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    fix()
