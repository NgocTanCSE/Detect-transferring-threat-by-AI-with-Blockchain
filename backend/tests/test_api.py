def test_health_check(client):
    resp = client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "operational"
    assert "Blockchain Risk Assessment API" in data["service"]

def test_assistant_chat_no_message(client):
    # Test that missing message results in 400
    resp = client.post("/assistant/chat", json={"message": ""})
    assert resp.status_code == 400
    assert "Missing message" in resp.text

def test_assistant_chat_basic_response(client):
    # Test basic chat functionality
    payload = {
        "message": "Chào bạn, bạn là ai?",
        "role": "operator",
        "screen_scope": "dashboard"
    }
    resp = client.post("/assistant/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "answer" in data
    assert "context" in data
    assert "sources" in data
