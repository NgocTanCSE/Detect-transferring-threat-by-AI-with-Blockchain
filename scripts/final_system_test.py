import requests
import time
import uuid
import sys

# Cấu hình các cổng dịch vụ
API_GATEWAY = "http://localhost:8001"
FRONTEND = "http://localhost:3000"

class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_step(msg):
    print(f"\n{Colors.BOLD}--- {msg} ---{Colors.ENDC}")

def test_health_checks():
    print_step("KIỂM TRA TRẠNG THÁI CÁC DỊCH VỤ (HEALTH CHECK)")
    services = {
        "API Gateway": f"{API_GATEWAY}/health",
        "Auth Service": "http://localhost:3001/health",
        "Wallet Service": "http://localhost:3002/health",
        "Alert Service": "http://localhost:3003/health",
        "Transfer Service": "http://localhost:3004/health",
        "Analytics Service": "http://localhost:3005/health",
        "Compliance Service": "http://localhost:3006/health",
        "AI Engine (Python)": "http://localhost:8000/"
    }
    
    for name, url in services.items():
        try:
            res = requests.get(url, timeout=3)
            if res.status_code == 200:
                print(f"{Colors.OKGREEN}[PASS]{Colors.ENDC} {name} đang hoạt động.")
            else:
                print(f"{Colors.FAIL}[FAIL]{Colors.ENDC} {name} trả về lỗi {res.status_code}")
        except Exception as e:
            print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} Không thể kết nối tới {name}: {e}")

def test_full_flow():
    print_step("TEST LUỒNG ĐẦY ĐỦ (REGISTER -> BALANCE -> TRANSFER -> CHAT)")
    username = f"testuser_{uuid.uuid4().hex[:6]}"
    email = f"{username}@example.com"
    wallet_address = "0x" + uuid.uuid4().hex[:40]
    
    # 1. Register
    reg_data = {
        "username": username,
        "email": email,
        "password": "password123",
        "wallet_address": wallet_address
    }
    
    try:
        res = requests.post(f"{API_GATEWAY}/auth/register", json=reg_data)
        if res.status_code == 201:
            print(f"{Colors.OKGREEN}[PASS]{Colors.ENDC} Đăng ký User mới thành công.")
            token = res.json().get('token')
            headers = {"Authorization": f"Bearer {token}"}
            
            # 2. Check Balance
            time.sleep(1)
            bal_res = requests.get(f"{API_GATEWAY}/wallet/{wallet_address}/balance?chain=ethereum", headers=headers)
            if bal_res.status_code == 200:
                balance = bal_res.json().get('balance_eth', 0)
                print(f"{Colors.OKGREEN}[PASS]{Colors.ENDC} Số dư ví: {balance} ETH.")
            
            # 3. Protected Transfer
            transfer_data = {
                "sender": wallet_address,
                "receiver": "0x1234567890123456789012345678901234567890",
                "amount": "1.0",
                "chain": "bsc",
                "asset": "BNB"
            }
            trans_res = requests.post(f"{API_GATEWAY}/transfer/protected", json=transfer_data, headers=headers)
            if trans_res.status_code in [200, 403]:
                data = trans_res.json()
                status = data.get('status')
                if status == 'blocked' or data.get('blocked'):
                    print(f"{Colors.OKGREEN}[PASS]{Colors.ENDC} AI đã CHẶN thành công giao dịch rủi ro.")
                else:
                    print(f"{Colors.OKBLUE}[INFO]{Colors.ENDC} Giao dịch: {status}")
            
            # 4. Chatbot
            chat_data = {
                "message": "Phân tích ví của tôi",
                "context": {"wallet_focus": wallet_address}
            }
            chat_res = requests.post(f"{API_GATEWAY}/assistant/chat", json=chat_data, headers=headers)
            if chat_res.status_code == 200:
                print(f"{Colors.OKGREEN}[PASS]{Colors.ENDC} Chatbot trả lời thành công.")
        else:
            print(f"{Colors.FAIL}[FAIL]{Colors.ENDC} Đăng ký lỗi: {res.text}")
    except Exception as e:
        print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} Lỗi hệ thống: {e}")

if __name__ == "__main__":
    print(f"{Colors.HEADER}{Colors.BOLD}=== HỆ THỐNG KIỂM TRA TỰ ĐỘNG BLOCKCHAIN AI SENTINEL ==={Colors.ENDC}")
    test_health_checks()
    test_full_flow()
    print(f"\n{Colors.HEADER}{Colors.BOLD}=== KIỂM TRA HOÀN TẤT ==={Colors.ENDC}")
