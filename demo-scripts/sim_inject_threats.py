import requests
import time
import random
import os
import sys

# Configuration from Environment Variables
API_URL = os.getenv("API_URL", "http://api-gateway:8001")
KNOWN_BLACKLIST = os.getenv("KNOWN_BLACKLIST", "0x098b716b8aaf21512996dc57eb0615e2383e2f96")

def get_auth_token():
    print(f"[{time.strftime('%H:%M:%S')}] Đang cố gắng lấy token xác thực từ {API_URL}...")
    # Sử dụng tên người dùng hợp lệ (tránh 'bot', 'spam', 'fake')
    bot_username = f"analyst_guardian_{random.randint(100, 999)}"
    bot_data = {
        "username": bot_username,
        "email": f"guardian_{random.randint(100, 999)}@sentinel.io",
        "password": "GuardianPassword123!",
        "wallet_address": "0x" + "".join(random.choices("0123456789abcdef", k=40))
    }
    try:
        # Register
        reg_res = requests.post(f"{API_URL}/auth/register", json=bot_data, timeout=10)
        
        # Login
        res = requests.post(f"{API_URL}/auth/login", json={"username": bot_data["username"], "password": bot_data["password"]}, timeout=10)
        if res.status_code == 200:
            token = res.json().get("access_token")
            print(f"[{time.strftime('%H:%M:%S')}] Xác thực thành công cho {bot_data['username']}")
            return token, bot_data["wallet_address"]
        else:
            print(f"[{time.strftime('%H:%M:%S')}] Xác thực thất bại [{res.status_code}]")
            return None, None
    except Exception as e:
        print(f"[{time.strftime('%H:%M:%S')}] Lỗi kết nối xác thực: {e}")
        return None, None

def inject_threat(token, sender):
    is_blacklist = random.random() < 0.5
    target = KNOWN_BLACKLIST if is_blacklist else "0x" + "".join(random.choices("0123456789abcdef", k=40))
    
    print(f"[{time.strftime('%H:%M:%S')}] Đang tiêm {'DANH SÁCH ĐEN' if is_blacklist else 'ĐÁNG NGỜ'} chuyển khoản -> {target[:10]}...")

    payload = {
        "sender": sender,
        "receiver": target,
        "amount": str(round(random.uniform(0.1, 10.0), 2)),
        "chain": random.choice(["ethereum", "bsc"]),
        "asset": "ETH"
    }
    if payload["chain"] == "bsc": payload["asset"] = "BNB"

    headers = {"Authorization": f"Bearer {token}"}
    try:
        # Use /protected-transfer (actual endpoint in transfer-service via gateway)
        res = requests.post(f"{API_URL}/protected-transfer", json=payload, headers=headers, timeout=10)
        status = "BLOCKED" if res.status_code == 403 else "WARNING" if res.status_code == 200 and "warning" in res.text else "SUCCESS"
        print(f"[{time.strftime('%H:%M:%S')}] Kết quả: {status} ({res.status_code})")
    except Exception as e:
        print(f"[{time.strftime('%H:%M:%S')}] Tiêm nhiễm thất bại: {e}")

def main():
    print("=== Đã khởi động Công cụ tiêm nhiễm kịch bản Sentinel ===")
    
    token = None
    sender = None
    
    while True:
        if not token:
            token, sender = get_auth_token()
            if not token:
                time.sleep(10)
                continue
        
        try:
            inject_threat(token, sender)
        except Exception as e:
            print(f"Lỗi vòng lặp chính: {e}")
            token = None # Force re-auth on error
        
        time.sleep(random.uniform(15.0, 30.0)) # Tần suất chậm hơn cho các mối đe dọa thực tế

if __name__ == "__main__":
    main()
