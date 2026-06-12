import time
import requests
import json
import sys
import os
import psycopg2
from uuid import uuid4

# Cấu hình từ biến môi trường
API_URL = os.getenv("API_URL", "http://api-gateway:8001")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://blockchain:blockchain123@postgres_main:5432/blockchain_main")
HACKER_IP = "203.0.113.42" # IP giả lập của hacker

class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_step(title, desc):
    print(f"\n{Colors.HEADER}{Colors.BOLD}=== {title} ==={Colors.ENDC}")
    print(f"{Colors.BLUE}{desc}{Colors.ENDC}")
    time.sleep(2)

def print_hacker(msg):
    print(f"{Colors.WARNING}[HACKER] {msg}{Colors.ENDC}")
    time.sleep(1.5)

def print_result(res):
    color = Colors.GREEN if res.status_code < 400 else Colors.FAIL
    try:
        data = res.json()
        error_msg = data.get('error', data.get('detail', str(data)))
    except:
        error_msg = res.text
    print(f"{color}>>> KẾT QUẢ: [{res.status_code}] {error_msg}{Colors.ENDC}\n")
    time.sleep(2)

def setup_demo_data():
    """Thiết lập dữ liệu demo: đưa ví vào blacklist và đánh dấu IP xấu."""
    try:
        print(f"{Colors.BLUE}[HỆ THỐNG] Đang thiết lập môi trường demo...{Colors.ENDC}")
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # 1. Đưa ví vào danh sách đen
        bad_wallet = "0xBadBadBadBadBadBadBadBadBadBadBadBad0001"
        cur.execute("INSERT INTO wallets (id, address, account_status) VALUES (%s, %s, 'active') ON CONFLICT DO NOTHING", [str(uuid4()), bad_wallet])
        cur.execute("INSERT INTO blacklist (id, address, reason, is_active) VALUES (%s, %s, 'Kẻ lừa đảo đã biết', true) ON CONFLICT (address) DO UPDATE SET is_active = true", [str(uuid4()), bad_wallet])
        
        # 2. Tạo dấu vết IP xấu từ người dùng bị đình chỉ trước đó
        suspended_id = str(uuid4())
        cur.execute("""
            INSERT INTO users (id, username, email, password_hash, warning_count, is_active) 
            VALUES (%s, 'scammer_joe', 'joe@scam.com', 'hash', 3, false)
            ON CONFLICT (username) DO UPDATE SET warning_count = 3, is_active = false
            RETURNING id
        """, [suspended_id])
        user_row = cur.fetchone()
        if user_row:
            suspended_id = user_row[0]
            
        cur.execute("INSERT INTO usage_logs (id, user_id, endpoint, method, ip_address) VALUES (%s, %s, '/auth/login', 'POST', %s) ON CONFLICT DO NOTHING", [str(uuid4()), suspended_id, HACKER_IP])
        
        conn.commit()
        cur.close()
        conn.close()
        print(f"{Colors.GREEN}[HỆ THỐNG] Môi trường demo (Blacklist & IP) đã sẵn sàng.{Colors.ENDC}\n")
    except Exception as e:
        print(f"{Colors.FAIL}[HỆ THỐNG] Thiết lập thất bại: {e}{Colors.ENDC}")

def run_demo():
    print_step("GIAI ĐOẠN 1: NÉ TRÁNH QUA VÍ", "Hacker cố gắng tạo tài khoản mới bằng ví đã bị đưa vào danh sách đen.")
    
    bad_wallet = "0xBadBadBadBadBadBadBadBadBadBadBadBad0001"
    print_hacker(f"Đang cố gắng đăng ký bằng ví cũ: {bad_wallet}...")
    res = requests.post(f"{API_URL}/auth/register", json={
        "username": f"scam_bot_{uuid4().hex[:5]}",
        "email": f"scam_{uuid4().hex[:5]}@crypto.com",
        "password": "Password123!",
        "wallet_address": bad_wallet
    }, headers={"x-forwarded-for": "1.1.1.1"}, timeout=10)
    print_result(res)

    print_step("GIAI ĐOẠN 2: NÉ TRÁNH QUA IP", "Hacker tạo ví mới hoàn toàn, nhưng vẫn sử dụng IP cũ đã từng bị hệ thống gắn cờ.")
    
    new_clean_wallet = f"0x{uuid4().hex[:40]}"
    print_hacker(f"Ví cũ bị chặn! Tôi sẽ dùng ví mới sạch: {new_clean_wallet}")
    print_hacker(f"Đăng ký lại từ IP mạng quen thuộc ({HACKER_IP})...")
    
    res = requests.post(f"{API_URL}/auth/register", json={
        "username": f"sneaky_user_{uuid4().hex[:5]}",
        "email": f"sneaky_{uuid4().hex[:5]}@crypto.com",
        "password": "Password123!",
        "wallet_address": new_clean_wallet
    }, headers={"x-forwarded-for": HACKER_IP}, timeout=10) # Sử dụng IP bẩn
    
    print_result(res)
    print(f"{Colors.BOLD}{Colors.GREEN}[!] AI Sentinel đã phát hiện hành vi né tránh qua IP! Kiểm tra Dashboard để xem cảnh báo 'EVASION_ATTEMPT'.{Colors.ENDC}")

if __name__ == "__main__":
    setup_demo_data()
    while True:
        try:
            run_demo()
        except Exception as e:
            print(f"{Colors.FAIL}Lỗi vòng lặp: {e}{Colors.ENDC}")
        
        print(f"\n{Colors.BLUE}=== Chu kỳ hoàn tất. Chờ 60 giây trước khi lặp lại... ==={Colors.ENDC}")
        time.sleep(60)
