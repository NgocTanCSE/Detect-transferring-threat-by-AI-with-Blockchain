from app.core.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(text("SELECT username, password_hash FROM users WHERE username = 'admin'"))
    for row in result:
        print(f"User: {row[0]}, Hash: {row[1]}")
