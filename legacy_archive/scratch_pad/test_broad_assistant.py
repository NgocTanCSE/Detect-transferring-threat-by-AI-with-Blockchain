import random
import requests

BASE_URL = "http://127.0.0.1:8000"
QUESTIONS = [
    "Policy rule nào đang ảnh hưởng mạnh nhất?",
    "Khi nào nên dismiss một case?",
    "Khi nào nên escalate một case?",
    "Ví có status under_review thì nên làm gì?",
    "Explain recursion in simple terms",
    "What is the difference between TCP and UDP?",
    "Give me a concise summary of project management basics",
    "So sánh AI assistant dựa trên rule-based và LLM",
]

payload_base = {
    "role": "operator",
    "screen_scope": "dashboard",
    "conversation_history": [],
    "context": {},
}

for question in QUESTIONS:
    payload = {**payload_base, "message": question}
    response = requests.post(f"{BASE_URL}/assistant/chat", json=payload, timeout=30)
    print("=" * 80)
    print("Q:", question)
    print("Status:", response.status_code)
    print("A:\n", response.json().get("answer", "<no answer>"))
