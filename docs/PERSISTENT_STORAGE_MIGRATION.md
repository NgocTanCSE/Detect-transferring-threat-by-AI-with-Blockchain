## Persistent Storage Migration

Hệ thống hỗ trợ 2 mode DB trên HF Spaces:
- Postgres mode: dùng `DATABASE_URL` cloud (Supabase).
- SQLite mode: fallback về `/data/blockchain_local.db` khi không có `DATABASE_URL` Postgres.

### 🎯 Thay Đổi

1. **entrypoint.sh** - Tự động detect HF Spaces và chọn DB mode theo `DATABASE_URL`
2. **migrate_persistent_storage.py** - Script migration tự động (chạy khi khởi động)
3. **seed_wallets.py** - Fixed bcrypt error, giờ chạy thành công và seed 5000 users

### 📍 Data Location

| Environment | Database Location | Persistent? |
|-------------|------------------|------------|
| **HF Spaces (Postgres mode)** | `postgresql://...` | ✅ YES (cloud persistent) |
| **HF Spaces (SQLite mode)** | `/data/blockchain_local.db` | ✅ YES (persists across restarts) |
| **Local Docker** | `postgresql://user:password@db:5432` | ✅ YES (PostgreSQL volume) |

### 🔄 Quá Trình Khởi Động

```bash
1. mkdir -p /data                                    # Tạo persistent directory
2. Detect SPACE_ID                                  # Đang chạy trên HF
3. Nếu DATABASE_URL là Postgres -> dùng remote DB   # Supabase mode
4. Nếu không có Postgres URL -> fallback SQLite /data
5. SQLite mode: migrate_persistent_storage.py + seed_wallets.py
6. supervisord                                      # Start backend/frontend/scanner
```

### 🧹 Reset Data (Clear Old)

Để xóa tất cả data cũ và tạo fresh database:

```bash
# Option 1: Manual (trong HF Spaces)
# Delete file: /data/blockchain_local.db
# Then rebuild Space

# Option 2: Bash script (local)
bash migrate_to_persistent_storage.sh

# Option 3: Python script (local)
python backend/migrate_persistent_storage.py
```

### ✅ Test Data After Reset

Seed sẽ tạo:
- **5000 demo users**: `demo_user_00000` - `demo_user_04999`
- **3 test accounts**: `admin`, `analyst`, `user`
- **Password cho tất cả**: `demo123` (tạm thời plaintext cho dev)

Login example:
```
Username: demo_user_00017
Password: demo123
```

### ⚠️ Notes

- Plaintext password chỉ cho **dev/test**
- Production data sẽ dùng bcrypt hashed passwords
- SQLite migration chạy **tự động** khi ở SQLite mode
- Data persists across **Space restarts/rebuilds** (SQLite `/data` hoặc cloud Postgres)
