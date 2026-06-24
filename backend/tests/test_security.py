import pytest


class TestSQLInjection:
    def test_sql_injection_in_wallet_address(self, client):
        payloads = [
            "'; DROP TABLE wallets; --",
            "1; SELECT * FROM users;",
            "' OR '1'='1",
            "'; DELETE FROM alerts; --",
            "0x' UNION SELECT * FROM users; --",
        ]
        for payload in payloads:
            resp = client.get(f"/analyze/{payload}")
            assert resp.status_code in (200, 400, 422, 404)
            assert "internal" not in resp.text.lower() or "error" not in resp.text.lower()

    def test_sql_injection_in_search_param(self, client):
        resp = client.get("/wallets?risk_category='; DROP TABLE wallets; --")
        assert resp.status_code in (200, 400, 422)

    def test_sql_injection_in_register_username(self, client):
        resp = client.post("/auth/_legacy_/register", json={
            "username": "'; DROP TABLE users; --",
            "email": "sqli@test.com",
            "password": "StrongPass123",
        })
        assert resp.status_code in (201, 400, 422)


class TestXSS:
    def test_xss_in_message_field(self, client):
        resp = client.post("/assistant/chat", json={
            "message": "<script>alert('xss')</script>",
            "role": "operator",
        })
        assert resp.status_code == 200
        data = resp.json()
        answer = data.get("answer", "")
        assert "<script>" not in answer

    def test_xss_in_feedback_message(self, client):
        resp = client.post("/feedback", json={
            "category": "bug",
            "message": "<img src=x onerror=alert(1)>",
        })
        assert resp.status_code in (200, 201, 400, 422)


class TestJWTSecurity:
    def test_expired_token_rejected(self, client):
        resp = client.get("/auth/me", headers={
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        })
        assert resp.status_code in (401, 403)

    def test_malformed_jwt_rejected(self, client):
        resp = client.get("/auth/me", headers={
            "Authorization": "Bearer not.a.token"
        })
        assert resp.status_code in (401, 403)

    def test_empty_token_rejected(self, client):
        resp = client.get("/auth/me", headers={
            "Authorization": "Bearer "
        })
        assert resp.status_code in (401, 403)

    def test_no_auth_header(self, client):
        resp = client.get("/auth/me")
        assert resp.status_code == 401


class TestRateLimit:
    def test_login_rate_limit_not_exceeded_at_low_count(self, client):
        for _ in range(3):
            resp = client.post("/auth/login", data={"username": "nonexistent", "password": "wrong"})
            assert resp.status_code in (401, 429)

    def test_register_rate_limit(self, client):
        for i in range(3):
            resp = client.post("/auth/_legacy_/register", json={
                "username": f"ratelimit_user_{i}",
                "email": f"ratelimit{i}@test.com",
                "password": "StrongPass123",
            })
            assert resp.status_code in (201, 400, 429)


class TestInputValidation:
    def test_register_xss_in_username(self, client):
        resp = client.post("/auth/_legacy_/register", json={
            "username": "<script>alert('xss')</script>",
            "email": "xss@test.com",
            "password": "StrongPass123",
        })
        assert resp.status_code in (201, 400, 422)

    def test_register_long_username_fails(self, client):
        resp = client.post("/auth/_legacy_/register", json={
            "username": "a" * 200,
            "email": "long@test.com",
            "password": "StrongPass123",
        })
        assert resp.status_code in (400, 422)

    def test_register_long_email_fails(self, client):
        resp = client.post("/auth/_legacy_/register", json={
            "username": "long_email_user",
            "email": "a" * 300 + "@test.com",
            "password": "StrongPass123",
        })
        assert resp.status_code in (400, 422)
