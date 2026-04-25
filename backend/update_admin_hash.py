from app.core.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("UPDATE users SET password_hash = '$2a$10$3Mu80qwb/Mq8PcGem0DMc.65s7UqaF9CBtuhsYBYv6c0Ry2YxHydO' WHERE username = 'admin'"))
    conn.commit()
    print("Updated admin password hash.")
