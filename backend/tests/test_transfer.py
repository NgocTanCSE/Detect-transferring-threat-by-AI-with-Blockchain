import pytest
import uuid


def _admin_token(client):
    """Register and return admin token for transfer test endpoints."""
    from sqlalchemy import text
    from app.core.database import SessionLocal
    uname = f"tadmin_{uuid.uuid4().hex[:6]}"
    reg = client.post("/auth/_legacy_/register", json={
        "username": uname, "email": f"{uname}@test.com",
        "password": "Pass@1234", "wallet_address": None,
    })
    if reg.status_code == 429:
        pytest.skip("Rate limited")
    assert reg.status_code == 201, reg.text
    db = SessionLocal()
    try:
        db.execute(text("UPDATE users SET role='admin' WHERE username=:u"), {"u": uname})
        db.commit()
    finally:
        db.close()
    login = client.post("/auth/login", data={"username": uname, "password": "Pass@1234"})
    assert login.status_code == 200, login.text
    return login.json()["access_token"]


class TestProtectedTransfer:
    def test_missing_sender_fails(self, client):
        token = _admin_token(client)
        resp = client.post("/transfer/protected", json={
            "to_wallet_id": "0xreceiver0000000000000000000000000000000000",
            "amount_eth": "0.1",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code in (400, 422)

    def test_missing_receiver_fails(self, client):
        resp = client.post("/transfer/protected", json={
            "from_wallet_id": "0xsender000000000000000000000000000000000000",
            "amount_eth": "0.1",
        })
        assert resp.status_code in (400, 422)

    def test_invalid_sender_address(self, client):
        resp = client.post("/transfer/protected", json={
            "from_wallet_id": "not_an_address",
            "to_wallet_id": "0xreceiver0000000000000000000000000000000000",
            "amount_eth": "0.1",
        })
        assert resp.status_code in (400, 404, 422)

    def test_negative_amount_fails(self, client):
        resp = client.post("/transfer/protected", json={
            "from_wallet_id": "0xsender000000000000000000000000000000000000",
            "to_wallet_id": "0xreceiver0000000000000000000000000000000000",
            "amount_eth": "-1.0",
        })
        assert resp.status_code in (400, 422)

    def test_zero_amount_fails(self, client):
        resp = client.post("/transfer/protected", json={
            "from_wallet_id": "0xsender000000000000000000000000000000000000",
            "to_wallet_id": "0xreceiver0000000000000000000000000000000000",
            "amount_eth": "0",
        })
        assert resp.status_code in (400, 422)

    def test_unsupported_chain_fails(self, client):
        resp = client.post("/transfer/protected", json={
            "from_wallet_id": "0xsender000000000000000000000000000000000000",
            "to_wallet_id": "0xreceiver0000000000000000000000000000000000",
            "amount_eth": "0.1",
            "chain_id": "solana",
        })
        assert resp.status_code in (400, 422, 404)
        assert "chain" in resp.text.lower() or "error" in resp.text.lower()


class TestSendEndpoint:
    def test_send_no_body(self, client):
        resp = client.post("/send", json={})
        assert resp.status_code in (400, 422)

    def test_send_invalid_amount(self, client):
        resp = client.post("/send", json={
            "from_address": "0xsender",
            "to_address": "0xreceiver",
            "amount": "abc",
        })
        assert resp.status_code in (400, 422, 500)


class TestSendWithWarning:
    def test_send_with_warning_no_body(self, client):
        resp = client.post("/send-with-warning", json={})
        assert resp.status_code in (400, 422)
