import random
import textwrap
from pathlib import Path

import requests

BASE_URL = "http://127.0.0.1:8000"
ENDPOINT = f"{BASE_URL}/assistant/chat"

QUESTIONS = [
    "Giải thích 4 chỉ số chính trên dashboard",
    "Alerts hôm nay tăng hay giảm so với ngữ cảnh hiện tại?",
    "Nên ưu tiên hành động nào trong 15 phút tới?",
    "Ví này có nguy cơ bị freeze không?",
    "Risk score của ví này đọc thế nào?",
    "Nên làm gì với ví có status under_review?",
    "Case nào nên escalate trước?",
    "Sự khác nhau giữa PENDING và FRAUD là gì?",
    "Khi nào nên dismiss một case?",
    "Policy rule nào đang ảnh hưởng mạnh nhất?",
    "Audit completeness có đạt không?",
    "Nên bổ sung control nào để giảm gaps?",
    "Giải thích mạng kết nối của wallet đang chọn",
    "Wallet focus này đang có bao nhiêu giao dịch và alerts?",
    "Đề xuất hành động với wallet này",
    "Hệ thống của dự án này đang gồm những phần nào?",
    "Giải thích ngắn gọn cách hoạt động của FastAPI",
    "So sánh AI assistant dựa trên rule-based và LLM",
    "Thời tiết hôm nay ở Hà Nội thế nào?",
    "Explain recursion in simple terms",
    "What is the difference between TCP and UDP?",
    "How do I improve Python performance?",
    "What is a stablecoin?",
    "Can you help me write a better prompt?",
    "Give me a concise summary of project management basics",
]

payload_base = {
    "role": "operator",
    "screen_scope": "dashboard",
    "wallet_address": None,
    "conversation_history": [],
    "context": {
        "screen_scope": "dashboard",
        "dashboard_role": "system_admin",
        "dashboard_feature_index": 0,
        "dashboard_feature_label": "Overview",
        "overview": {
            "total_wallets": 42,
            "total_alerts": 17,
            "critical_alerts": 3,
            "alerts_today": 5,
            "total_blocked": 2,
        },
        "top_risky_wallets": [],
    },
}

random.seed()
selected_questions = random.sample(QUESTIONS, 10)

print("Selected questions:\n")
for idx, question in enumerate(selected_questions, start=1):
    print(f"{idx}. {question}")
print("\nResponses:\n" + "=" * 80)

for idx, question in enumerate(selected_questions, start=1):
    payload = dict(payload_base)
    payload["message"] = question
    try:
        response = requests.post(ENDPOINT, json=payload, timeout=90)
        status = response.status_code
        body = response.json() if response.headers.get("content-type", "").startswith("application/json") else {"raw": response.text}
        answer = body.get("answer") if isinstance(body, dict) else None
        print(f"\n[{idx}] Q: {question}")
        print(f"Status: {status}")
        if answer:
            print("A:")
            print(textwrap.fill(str(answer), width=100))
        else:
            print("Body:")
            print(textwrap.shorten(str(body), width=1000, placeholder=" ..."))
    except Exception as exc:
        print(f"\n[{idx}] Q: {question}")
        print(f"ERROR: {exc}")
