with open("database/seed_demo_data.sql", "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if "blacklist" in line.lower():
        print(f"Line {idx+1}: {line.strip()}")
        # print 5 lines before and 15 lines after
        start = max(0, idx - 5)
        end = min(len(lines), idx + 15)
        for i in range(start, end):
            print(f"  {i+1}: {lines[i].rstrip()}")
        break
