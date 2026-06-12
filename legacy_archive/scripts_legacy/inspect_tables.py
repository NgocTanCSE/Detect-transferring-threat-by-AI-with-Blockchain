import psycopg2

def inspect():
    url = "postgresql://blockchain:blockchain123@localhost:5432/blockchain_main"
    conn = psycopg2.connect(url)
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE column_name = 'id' AND table_schema = 'public';
        """)
        rows = cur.fetchall()
        print("--- Table Columns named 'id' in main DB ---")
        for row in rows:
            print(f"Table: {row[0]}, Column: {row[1]}, Type: {row[2]}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    inspect()
