import re

def parse_sql(sql):
    # Find all INSERT INTO statements
    inserts = re.findall(r"(INSERT INTO\s+\w+\s*\([^)]+\)\s*VALUES\s*(?:[^;]+);)", sql, re.IGNORECASE)
    print(f"Found {len(inserts)} INSERT statements.")
    
    for idx, insert in enumerate(inserts):
        # Extract table name and column list
        match = re.match(r"INSERT INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*(.*)", insert, re.IGNORECASE | re.DOTALL)
        if not match:
            continue
            
        table_name, cols_str, values_str = match.groups()
        cols = [c.strip() for c in cols_str.split(",")]
        
        # Split VALUES rows (handle nested parenthesis or simple split)
        # For simplicity, split by pages of VALUES rows
        rows = []
        # Find all blocks inside parenthesis
        rows_raw = re.findall(r"\(([^)]+)\)", values_str)
        
        print(f"Table: {table_name}, Column count: {len(cols)}")
        for r_idx, row in enumerate(rows_raw):
            vals = [v.strip() for v in row.split(",")]
            if len(vals) != len(cols):
                print(f"  -> ROW {r_idx} has {len(vals)} values! Mismatch!")
                print(f"     Columns: {cols}")
                print(f"     Values: {vals}")

if __name__ == "__main__":
    with open("database/seed_demo_data.sql", "r", encoding="utf-8") as f:
        parse_sql(f.read())
