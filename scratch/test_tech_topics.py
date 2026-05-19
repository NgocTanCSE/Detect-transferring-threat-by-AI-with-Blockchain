import requests

BASE_URL = "http://127.0.0.1:8000"
QUESTIONS = [
    "Database schema là gì?",
    "SQL query dùng để làm gì?",
    "Docker và container khác nhau thế nào?",
    "Docker Compose dùng khi nào?",
    "Git branch, commit, merge khác nhau ra sao?",
    "Prompt tốt cần những phần nào?",
    "HTTP và API có quan hệ gì?",
    "TCP và UDP khác nhau thế nào?",
]

for question in QUESTIONS:
    response = requests.post(
        f"{BASE_URL}/assistant/chat",
        json={
            "message": question,
            "role": "operator",
            "screen_scope": "dashboard",
            "conversation_history": [],
            "context": {},
        },
        timeout=30,
    )
    print("=" * 80)
    print("Q:", question)
    print("Status:", response.status_code)
    print("A:\n", response.json().get("answer", "<no answer>"))
