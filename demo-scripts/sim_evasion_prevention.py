import requests
import json
import time
import sys
import os
import uuid

# Cấu hình từ biến môi trường
API_URL = os.getenv("API_URL", "http://api-gateway:8001")

class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_step(step, text):
    print(f"\n{Colors.BOLD}[BƯỚC {step}]{Colors.ENDC} {text}")

def main():
    print(f"{Colors.HEADER}=== AI SENTINEL: PHÁT HIỆN VÀ CHẶN HÀNH VI NÉ TRÁNH (EVASION) ==={Colors.ENDC}")
    
    while True:
        try:
            unique_id = uuid.uuid4().hex[:8]
            test_wallet = f"0x{uuid.uuid4().hex[:40]}"
            test_user = f"offender_{unique_id}"
            test_email = f"offender_{unique_id}@evil.com"
            
            # 1. Đăng ký người dùng mới
            print_step(1, "Đăng ký người dùng mới với ví sạch...")
            payload = {
                "username": test_user,
                "email": test_email,
                "password": "Password123!",
                "wallet_address": test_wallet
            }
            
            res = requests.post(f"{API_URL}/auth/register", json=payload, timeout=10)
            if res.status_code == 201:
                print(f"{Colors.OKGREEN}✅ Người dùng '{test_user}' đã đăng ký thành công.{Colors.ENDC}")
            else:
                print(f"{Colors.FAIL}❌ Đăng ký thất bại: {res.text}{Colors.ENDC}")
                time.sleep(30)
                continue

            # 2. Gây ra các cảnh báo rủi ro để ví bị ĐÌNH CHỈ (Suspended)
            print_step(2, "Mô phỏng hành vi rủi ro để hệ thống ĐÌNH CHỈ ví...")
            print(f"Thực hiện 3 lần chuyển khoản đến địa chỉ rủi ro cao để kích hoạt tự động khóa ví {test_wallet}...")
            
            # Lấy token đăng nhập
            login_res = requests.post(f"{API_URL}/auth/login", json={"username": test_user, "password": "Password123!"}, timeout=10)
            token = login_res.json().get("access_token")
            headers = {"Authorization": f"Bearer {token}"}
            
            risky_payload = {
                "sender": test_wallet,
                "receiver": "0x1111111111111111111111111111111111111111", # Địa chỉ rủi ro mức độ Cảnh báo (65%)
                "amount": "1.0",
                "confirm_risk": True # Phớt lờ cảnh báo để bị tính điểm phạt
            }
            
            for i in range(1, 4):
                print(f"  Thử chuyển khoản lần {i}/3...")
                res = requests.post(f"{API_URL}/protected-transfer", json=risky_payload, headers=headers, timeout=10)
                print(f"  [{res.status_code}] {res.json().get('message', res.text)}")
                time.sleep(2)

            print(f"\n{Colors.OKCYAN}Trạng thái hiện tại: Ví {test_wallet} đã bị hệ thống ĐÌNH CHỈ do vi phạm.{Colors.ENDC}")

            # 3. Thử né tránh (Đăng ký tài khoản mới nhưng dùng lại ví cũ bị chặn)
            print_step(3, "HÀNH VI NÉ TRÁNH: Cố gắng tạo TÀI KHOẢN MỚI với CÙNG VÍ BỊ CHẶN...")
            
            evasion_user = f"sneaky_dev_{unique_id}"
            evasion_payload = {
                "username": evasion_user,
                "email": f"sneaky_{unique_id}@proton.me",
                "password": "Password123!",
                "wallet_address": test_wallet # VÍ ĐÃ BỊ ĐÌNH CHỈ
            }
            
            print(f"Đang cố gắng đăng ký '{evasion_user}' bằng ví {test_wallet}...")
            res = requests.post(f"{API_URL}/auth/register", json=evasion_payload, timeout=10)
            
            if res.status_code == 403:
                print(f"\n{Colors.OKGREEN}🎯 AI SENTINEL THÀNH CÔNG: Chặn đăng ký do phát hiện ví bị đình chỉ!{Colors.ENDC}")
                print(f"{Colors.FAIL}Thông báo lỗi: {res.json().get('error')}{Colors.ENDC}")
            else:
                print(f"\n{Colors.FAIL}❌ CẢNH BÁO: Hệ thống để lọt hành vi né tránh! (Status: {res.status_code}){Colors.ENDC}")

            print(f"\n{Colors.HEADER}--- Hoàn tất vòng lặp. Chờ 60 giây... ---{Colors.ENDC}")
            time.sleep(60)

        except Exception as e:
            print(f"{Colors.FAIL}❌ Lỗi: {e}{Colors.ENDC}")
            time.sleep(30)

if __name__ == "__main__":
    main()
