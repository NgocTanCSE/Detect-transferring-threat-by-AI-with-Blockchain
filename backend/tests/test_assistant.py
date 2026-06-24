import pytest


class TestAssistantChat:
    def test_empty_message_fails(self, client):
        resp = client.post("/assistant/chat", json={"message": ""})
        assert resp.status_code in (400, 422)
        data = resp.json()
        assert "detail" in data or "error" in data or "message" in data

    def test_missing_message_field_fails(self, client):
        resp = client.post("/assistant/chat", json={})
        assert resp.status_code in (400, 422)

    def test_invalid_role_defaults_to_operator(self, client):
        resp = client.post("/assistant/chat", json={
            "message": "Xin chao",
            "role": "invalid_role_xyz",
        })
        assert resp.status_code == 200
        assert "answer" in resp.json()

    def test_with_wallet_address(self, client):
        resp = client.post("/assistant/chat", json={
            "message": "Phan tich vi",
            "role": "operator",
            "wallet_address": "0x0000000000000000000000000000000000000001",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "answer" in data
        assert len(data["answer"]) > 0

    def test_with_conversation_history(self, client):
        resp = client.post("/assistant/chat", json={
            "message": "Tiep theo",
            "role": "operator",
            "conversation_history": [
                {"role": "user", "content": "Xin chao"},
                {"role": "assistant", "content": "Chao ban"},
            ],
            "screen_scope": "dashboard"
        })
        assert resp.status_code == 200

    def test_rate_limit_not_exceeded(self, client):
        for _ in range(3):
            resp = client.post("/assistant/chat", json={
                "message": "test",
                "role": "operator",
            })
            assert resp.status_code == 200

    def test_response_has_required_fields(self, client):
        resp = client.post("/assistant/chat", json={
            "message": "System status?",
            "role": "admin",
            "screen_scope": "dashboard"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "answer" in data
        assert isinstance(data["answer"], str)
