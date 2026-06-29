import sqlite3
import json
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

DB_PATH = r"C:\Users\Ngoc Tan\.local\share\mimocode\mimocode.db"
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

PROJECT_ID = 'e03a6233-9eeb-47d1-ab9f-a5dc1088b781'

# 1. All sessions for this project
print("=== ALL SESSIONS FOR THIS PROJECT ===")
cur.execute("""
    SELECT id, title, time_created, time_updated, summary_additions, summary_deletions, summary_files
    FROM session
    WHERE project_id = ?
    ORDER BY time_created DESC
""", (PROJECT_ID,))
for row in cur.fetchall():
    sid = row[0]
    title = row[1]
    created = row[2]
    from datetime import datetime
    dt = datetime.fromtimestamp(created/1000).strftime('%Y-%m-%d %H:%M')
    print(f"  {sid} | {title} | {dt} | +{row[4]} -{row[5]} | {row[6]} files")

# 2. For each session, get task info
print("\n=== TASKS PER SESSION ===")
cur.execute("""
    SELECT s.id, s.title, t.id, t.status, t.summary, t.created_at
    FROM session s
    LEFT JOIN task t ON t.session_id = s.id
    WHERE s.project_id = ?
    ORDER BY s.time_created DESC, t.created_at DESC
""", (PROJECT_ID,))
for row in cur.fetchall():
    if row[2]:
        print(f"  [{row[0][:20]}] Task {row[2]}: {row[3]} - {row[4][:80]}")

# 3. Get user messages from recent sessions to find decisions/rules
print("\n=== USER MESSAGES (last 20 assistant turns with decisions) ===")
cur.execute("""
    SELECT m.id, m.session_id, m.agent_id, m.time_created, m.data
    FROM message m
    JOIN session s ON s.id = m.session_id
    WHERE s.project_id = ?
      AND json_extract(m.data, '$.role') = 'user'
    ORDER BY m.time_created DESC
    LIMIT 40
""", (PROJECT_ID,))
for row in cur.fetchall():
    data = json.loads(row[4])
    content = str(data.get('content', ''))[:200]
    from datetime import datetime
    dt = datetime.fromtimestamp(row[3]/1000).strftime('%Y-%m-%d %H:%M')
    print(f"  [{dt}] {row[1][:20]}: {content}")

conn.close()
