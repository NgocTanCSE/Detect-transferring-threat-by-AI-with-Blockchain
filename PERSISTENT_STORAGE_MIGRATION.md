## Persistent Storage Migration

Hệ thống đã được update để **lưu tất cả data ở `/data`** (persistent bucket trên HF Spaces).

### 🎯 Thay Đổi

1. **entrypoint.sh** - Tự động detect HF Spaces và set `DATABASE_URL=/data/blockchain_local.db`
2. **migrate_persistent_storage.py** - Script migration tự động (chạy khi khởi động)
3. **seed_wallets.py** - Fixed bcrypt error, giờ chạy thành công và seed 5000 users

### 📍 Data Location

| Environment | Database Location | Persistent? |
|-------------|------------------|------------|
| **HF Spaces** | `/data/blockchain_local.db` | ✅ YES (persists across restarts) |
| **Local Docker** | `postgresql://user:password@db:5432` | ✅ YES (PostgreSQL volume) |

### 🔄 Quá Trình Khởi Động

```bash
1. mkdir -p /data                                    # Tạo persistent directory
2. Detect SPACE_ID → set DATABASE_URL → /data       # Force persistent storage
3. migrate_persistent_storage.py                    # Chuyển data cũ (nếu có) → /data
4. seed_wallets.py                                  # Seed 5000 demo users
5. supervisord                                      # Start backend/frontend/scanner
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
- Migration chạy **tự động** trên HF Spaces lần đầu
- Data persists across **Space restarts/rebuilds** (nếu không xóa `/data` manually)
