with open("database/seed_demo_data.sql", "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if "blacklist" in line.lower() and "insert into" in line.lower():
        print(f"Line {idx+1}: {line.strip()}")
        # print 20 lines after
        for i in range(idx, min(len(lines), idx + 20)):
            print(f"  {i+1}: {lines[i].rstrip()}")
