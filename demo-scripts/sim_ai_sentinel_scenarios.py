import requests
import json
import time
import sys
import os
import random
import uuid

API_URL = os.getenv("API_URL", "http://api-gateway:8001")

# We use addresses that were seeded into the database
BLACKLISTED_WALLET = "0x098b716b8aaf21512996dc57eb0615e2383e2f96" # Ronin Bridge Exploiter
UNKNOWN_WALLET = "0x1111111111111111111111111111111111111111" # Unknown wallet, will trigger AI

class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_step(msg):
    print(f"\n{Colors.OKCYAN}{Colors.BOLD}▶ {msg}{Colors.ENDC}")

def print_result(data, success=True):
    color = Colors.OKGREEN if success else Colors.FAIL
    print(f"{color}{json.dumps(data, indent=2, ensure_ascii=False)}{Colors.ENDC}")

def wait(seconds=3):
    print(f"{Colors.WARNING}Wait {seconds}s...{Colors.ENDC}")
    time.sleep(seconds)

def get_auth_token():
    # Tạo một tài khoản mới mỗi chu kỳ để tránh việc bot bị khóa vĩnh viễn (auto-suspend)
    # sau khi phớt lờ cảnh báo quá 3 lần ở Kịch bản 2.
    unique_id = uuid.uuid4().hex[:6]
    bot_username = f"alice_demo_{unique_id}"
    bot_password = "GuardianPassword123!"
    bot_wallet = f"0x{uuid.uuid4().hex[:40]}"
    
    bot_data = {
        "username": bot_username,
        "email": f"{bot_username}@demo.io",
        "password": bot_password,
        "wallet_address": bot_wallet
    }
    
    try:
        reg_res = requests.post(f"{API_URL}/auth/register", json=bot_data, timeout=10)
        
        # Đăng nhập để lấy token
        res = requests.post(f"{API_URL}/auth/login", json={"username": bot_username, "password": bot_password}, timeout=10)
        if res.status_code == 200:
            token = res.json().get("access_token")
            print(f"[{time.strftime('%H:%M:%S')}] Bot xác thực thành công (User: {bot_username}).")
            return token, bot_wallet
        else:
            print(f"[{time.strftime('%H:%M:%S')}] Đăng nhập thất bại ({res.status_code}): {res.text}")
            print(f"Vui lòng kiểm tra xem dịch vụ auth-service có đang chạy đúng không.")
            return None, None
    except Exception as e:
        print(f"[{time.strftime('%H:%M:%S')}] Lỗi kết nối xác thực: {e}")
        return None, None

def demo_scam_prevention(token, sender_wallet):
    print_step("KỊCH BẢN 1: Ngăn chặn chuyển khoản đến các địa chỉ lừa đảo/hacker đã biết (Danh sách đen)")
    print(f"Người nhận: {BLACKLISTED_WALLET} (Địa chỉ lừa đảo/bị cấm đã biết)")

    payload = {
        "sender": sender_wallet,
        "receiver": BLACKLISTED_WALLET,
        "amount": "1.5"
    }
    headers = {"Authorization": f"Bearer {token}"}

    print("Đang gọi POST /protected-transfer... (Hệ thống đang phân tích...)")
    try:
        response = requests.post(f"{API_URL}/protected-transfer", json=payload, headers=headers, timeout=10)
        data = response.json()
        if response.status_code == 403 and data.get("blocked"):
            print_result(data, success=True)
            print(f"\n{Colors.OKGREEN}✓ THÀNH CÔNG: Hệ thống đã chặn ngay lập tức giao dịch chuyển khoản!{Colors.ENDC}")
        else:
            print_result(data, success=False)
            print(f"{Colors.FAIL}❌ THẤT BẠI: Hệ thống KHÔNG chặn giao dịch chuyển khoản đáng lẽ phải bị chặn.{Colors.ENDC}")
    except Exception as e:
        print(f"{Colors.FAIL}Lỗi: {e}{Colors.ENDC}")

def demo_ai_risk_warning(token, sender_wallet):
    print_step("KỊCH BẢN 2: Phát hiện rửa tiền AI & Cảnh báo rủi ro")
    print(f"Người nhận: {UNKNOWN_WALLET} (Không xác định/Đáng ngờ)")

    payload = {
        "sender": sender_wallet,
        "receiver": UNKNOWN_WALLET,
        "amount": "5.0"
    }
    headers = {"Authorization": f"Bearer {token}"}

    print("Đang gọi POST /protected-transfer... (AI đang phân tích...)")
    try:
        response = requests.post(f"{API_URL}/protected-transfer", json=payload, headers=headers, timeout=15)
        data = response.json()
        
        if data.get("status") == "warning":
            print_result(data, success=True)
            print(f"\n{Colors.OKGREEN}✓ THÀNH CÔNG: AI đã phát hiện rủi ro và đưa ra CẢNH BÁO!{Colors.ENDC}")
            
            wait(4)
            print("\nĐang mô phỏng người dùng BỎ QUA cảnh báo (force_proceed=true)...")
            
            payload["force_proceed"] = True
            response2 = requests.post(f"{API_URL}/protected-transfer", json=payload, headers=headers, timeout=15)
            data2 = response2.json()
            print_result(data2, success=True)
            if data2.get("status") == "success":
                print(f"{Colors.OKGREEN}✓ Giao dịch đã tiến hành, cảnh báo đã được ghi lại.{Colors.ENDC}")
            else:
                print(f"{Colors.FAIL}❌ THẤT BẠI: Giao dịch không tiến hành sau khi bỏ qua cảnh báo.{Colors.ENDC}")
        else:
            print_result(data, success=False)
            print(f"{Colors.FAIL}❌ THẤT BẠI: AI KHÔNG phát hiện rủi ro hoặc không đưa ra cảnh báo.{Colors.ENDC}")
    except Exception as e:
        print(f"{Colors.FAIL}Lỗi: {e}{Colors.ENDC}")

def demo_ai_analysis_report(token):
    print_step("KỊCH BẢN 3: Báo cáo phân tích mối đe dọa AI chuyên sâu")
    print(f"Mục tiêu: {UNKNOWN_WALLET}")

    headers = {"Authorization": f"Bearer {token}"}
    print("Đang gọi GET /analyze/<address>... (Đang tạo thông tin chi tiết AI...)")
    try:
        response = requests.get(f"{API_URL}/analyze/{UNKNOWN_WALLET}", headers=headers, timeout=60)
        data = response.json()
        print_result(data, success=True)
        print(f"\n{Colors.OKGREEN}✓ THÀNH CÔNG: Công cụ AI đã cung cấp thông tin chi tiết!{Colors.ENDC}")
    except Exception as e:
        print(f"{Colors.FAIL}Lỗi: {e}{Colors.ENDC}")

def main():
    print(f"{Colors.HEADER}{Colors.BOLD}===================================================={Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}   BLOCKCHAIN AI SENTINEL - TRÌNH CHẠY DEMO TỰ ĐỘNG  {Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}===================================================={Colors.ENDC}")
    
    while True:
        try:
            token, sender_wallet = get_auth_token()
            if not token:
                print(f"{Colors.FAIL}Không thể xác thực bot. Đang thử lại sau 10 giây...{Colors.ENDC}")
                time.sleep(10)
                continue

            print(f"\n[{time.strftime('%H:%M:%S')}] --- Bắt đầu chu kỳ demo tự động ---")
            
            demo_scam_prevention(token, sender_wallet)
            wait(5)
            
            demo_ai_risk_warning(token, sender_wallet)
            wait(5)
            
            demo_ai_analysis_report(token)
            
            print(f"\n{Colors.OKGREEN}Chu kỳ hoàn thành thành công.{Colors.ENDC}")
        except Exception as e:
            print(f"{Colors.FAIL}Lỗi chu kỳ demo: {e}{Colors.ENDC}")
            
        print(f"\n{Colors.OKCYAN}Nghỉ 60 giây trước chu kỳ tiếp theo...{Colors.ENDC}")
        time.sleep(60)

if __name__ == "__main__":
    main()