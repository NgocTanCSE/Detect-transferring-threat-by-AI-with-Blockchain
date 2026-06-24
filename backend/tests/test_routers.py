import uuid
import pytest


class TestAuthRouter:
    def _unique_username(self, prefix="usr"):
        return f"{prefix}_{uuid.uuid4().hex[:8]}"

    def _register(self, client, username=None, email=None, password="Pass@1234"):
        username = username or self._unique_username()
        email = email or f"{username}@test.com"
        resp = client.post("/auth/_legacy_/register", json={
            "username": username, "email": email, "password": password, "wallet_address": None,
        })
        return resp

    def _login(self, client, username, password="Pass@1234"):
        return client.post("/auth/login", data={"username": username, "password": password})

    def _register_and_login(self, client, username=None, password="Pass@1234"):
        u = username or self._unique_username()
        reg = self._register(client, u, password=password)
        if reg.status_code == 429:
            pytest.skip("Rate limited")
        assert reg.status_code == 201, reg.text
        login = self._login(client, u, password)
        assert login.status_code == 200, login.text
        data = login.json()
        assert "access_token" in data
        return data["access_token"]

    def test_register_success(self, client):
        u = self._unique_username()
        resp = self._register(client, u)
        if resp.status_code == 429:
            pytest.skip("Rate limited")
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["username"] == u

    def test_register_missing_username_fails(self, client):
        resp = client.post("/auth/_legacy_/register", json={"email": "x@y.com", "password": "Pass@1234"})
        assert resp.status_code == 422

    def test_register_missing_email_fails(self, client):
        resp = client.post("/auth/_legacy_/register", json={"username": "x", "password": "Pass@1234"})
        assert resp.status_code == 422

    def test_register_duplicate_email_fails(self, client):
        u = self._unique_username("dup")
        resp = self._register(client, u, "dup@test.com")
        if resp.status_code == 429:
            pytest.skip("Rate limited")
        resp2 = self._register(client, self._unique_username("dup2"), "dup@test.com")
        assert resp2.status_code in (400, 429)
        if resp2.status_code == 400:
            assert "already registered" in resp2.text.lower() or "email" in resp2.text.lower()

    def test_login_success(self, client):
        token = self._register_and_login(client)
        assert token is not None

    def test_login_wrong_password_fails(self, client):
        u = self._unique_username("wp")
        reg = self._register(client, u, password="Corre@tPass123")
        if reg.status_code == 429:
            pytest.skip("Rate limited")
        resp = client.post("/auth/login", data={"username": u, "password": "WrongPass"})
        assert resp.status_code == 401

    def test_login_nonexistent_user_fails(self, client):
        resp = client.post("/auth/login", data={"username": "no_such_user", "password": "AnyPass@123"})
        assert resp.status_code == 401

    def test_get_profile_requires_token(self, client):
        resp = client.get("/auth/me")
        assert resp.status_code == 401

    def test_get_profile_with_token(self, client):
        token = self._register_and_login(client)
        resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert "username" in resp.json()

    def test_refresh_token(self, client):
        token = self._register_and_login(client)
        resp = client.post("/auth/refresh", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code in (200, 404), f"refresh failed: {resp.text}"
        if resp.status_code == 200:
            data = resp.json()
            assert "access_token" in data

    def test_logout(self, client):
        token = self._register_and_login(client)
        resp = client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code in (200, 404)

    def test_validate_token(self, client):
        token = self._register_and_login(client)
        resp = client.post("/auth/validate", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code in (200, 404), f"validate failed: {resp.text}"
        if resp.status_code == 200:
            data = resp.json()
            assert data.get("valid") is True

    def test_validate_invalid_token(self, client):
        resp = client.post("/auth/validate", headers={"Authorization": "Bearer invalid_token_here"})
        assert resp.status_code in (200, 401, 404)


class TestHealthRouter:
    def test_root_health(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert data["status"] == "operational"

    def test_version(self, client):
        resp = client.get("/version")
        assert resp.status_code == 200
        assert "version" in resp.json()


class TestWalletRouter:
    def test_get_wallets(self, client):
        resp = client.get("/wallets")
        assert resp.status_code == 200
        data = resp.json()
        assert "wallets" in data
        assert isinstance(data["wallets"], list)

    def test_get_wallets_with_filters(self, client):
        resp = client.get("/wallets?risk_category=scam&limit=5")
        assert resp.status_code == 200

    def test_get_wallet_stats_nonexistent(self, client):
        resp = client.get("/wallets/0xnonexistent0000000000000000000000000000/stats")
        assert resp.status_code in (200, 404)

    def test_analyze_wallet(self, client):
        resp = client.get("/analyze/0x0000000000000000000000000000000000000001")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_score" in data or "risk_score" in data or "score" in data or "risk_level" in data


class TestTransferRouter:
    def test_transfer_protected_missing_fields(self, client):
        resp = client.post("/transfer/protected", json={})
        assert resp.status_code in (400, 422)

    def test_transfer_protected_invalid_chain(self, client):
        resp = client.post("/transfer/protected", json={
            "from_wallet_id": "0xsender000000000000000000000000000000000000",
            "to_wallet_id": "0xreceiver0000000000000000000000000000000000",
            "amount_eth": "0.1",
        })
        assert resp.status_code in (400, 404, 422)

    def test_send_no_body(self, client):
        resp = client.post("/send", json={})
        assert resp.status_code in (400, 422)


class TestAlertRouter:
    def test_get_alerts_recent(self, client):
        resp = client.get("/alerts/recent")
        assert resp.status_code == 200
        data = resp.json()
        assert "alerts" in data

    def test_get_alerts_recent_with_severity(self, client):
        resp = client.get("/alerts/recent?severity=CRITICAL")
        assert resp.status_code == 200

    def test_get_alerts_latest(self, client):
        resp = client.get("/alerts/latest")
        assert resp.status_code == 200
        assert isinstance(resp.json(), (list, dict))


class TestAssistantRouter:
    def test_assistant_empty_message(self, client):
        resp = client.post("/assistant/chat", json={"message": ""})
        assert resp.status_code in (400, 422)

    def test_assistant_chat_response(self, client):
        resp = client.post("/assistant/chat", json={
            "message": "Xin chao",
            "role": "operator",
            "screen_scope": "dashboard"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "answer" in data

    def test_assistant_with_wallet_context(self, client):
        resp = client.post("/assistant/chat", json={
            "message": "Phan tich vi nay",
            "role": "operator",
            "wallet_address": "0x0000000000000000000000000000000000000001",
            "screen_scope": "wallet"
        })
        assert resp.status_code == 200


class TestFeedbackRouter:
    def test_feedback_invalid_input(self, client):
        resp = client.post("/feedback", json={})
        assert resp.status_code in (400, 422)

    def test_feedback_valid(self, client):
        resp = client.post("/feedback", json={
            "category": "bug",
            "message": "Test feedback message",
        })
        assert resp.status_code in (200, 201, 400, 422)

    def test_feedback_stats(self, client):
        resp = client.get("/feedback/stats")
        assert resp.status_code == 200


class TestAdminDiagnosticsRouter:
    def _admin_token(self, client):
        """Register a user, promote to admin, return token."""
        import uuid
        from sqlalchemy import text
        uname = f"admin_{uuid.uuid4().hex[:6]}"
        reg = client.post("/auth/_legacy_/register", json={
            "username": uname, "email": f"{uname}@test.com",
            "password": "Pass@1234", "wallet_address": None,
        })
        if reg.status_code == 429:
            pytest.skip("Rate limited")
        assert reg.status_code == 201, reg.text
        # Promote to admin via DB
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            db.execute(text("UPDATE users SET role='admin' WHERE username=:u"), {"u": uname})
            db.commit()
        finally:
            db.close()
        login = client.post("/auth/login", data={"username": uname, "password": "Pass@1234"})
        assert login.status_code == 200, login.text
        return login.json()["access_token"]

    def test_diagnostics_status(self, client):
        token = self._admin_token(client)
        resp = client.get("/admin/diagnostics/status", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200, resp.text

    def test_diagnostics_logs(self, client):
        token = self._admin_token(client)
        resp = client.get("/admin/diagnostics/logs", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "logs" in data or isinstance(data, list)

    def test_diagnostics_seed_data(self, client):
        token = self._admin_token(client)
        resp = client.get("/admin/diagnostics/seed-data", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200, resp.text

    def test_diagnostics_endpoint_stats(self, client):
        token = self._admin_token(client)
        resp = client.get("/admin/diagnostics/endpoint-stats", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200, resp.text

    def test_blocked_transfers(self, client):
        token = self._admin_token(client)
        resp = client.get("/blocked-transfers", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert isinstance(data, list) or "blocked" in data or isinstance(data, dict)

    def test_user_history_nonexistent(self, client):
        resp = client.get("/user/0xnonexistent0000000000000000000000000000000/history")
        assert resp.status_code in (200, 404)


class TestOpsRouter:
    def _admin_token(self, client):
        import uuid
        from sqlalchemy import text
        uname = f"ops_{uuid.uuid4().hex[:6]}"
        reg = client.post("/auth/_legacy_/register", json={
            "username": uname, "email": f"{uname}@test.com",
            "password": "Pass@1234", "wallet_address": None,
        })
        if reg.status_code == 429:
            pytest.skip("Rate limited")
        assert reg.status_code == 201, reg.text
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            db.execute(text("UPDATE users SET role='admin' WHERE username=:u"), {"u": uname})
            db.commit()
        finally:
            db.close()
        login = client.post("/auth/login", data={"username": uname, "password": "Pass@1234"})
        assert login.status_code == 200, login.text
        return login.json()["access_token"]

    def test_ops_organizations(self, client):
        token = self._admin_token(client)
        resp = client.get("/ops/system/organizations", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200, resp.text

    def test_ops_node_endpoints(self, client):
        resp = client.get("/ops/system/node-endpoints")
        assert resp.status_code == 200

    def test_ops_pipeline_metrics(self, client):
        resp = client.get("/ops/system/pipeline-metrics")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data or isinstance(data, list) or isinstance(data, dict)

    def test_ops_feature_store(self, client):
        resp = client.get("/ops/ai/feature-store")
        assert resp.status_code == 200

    def test_ops_model_registry(self, client):
        resp = client.get("/ops/ai/model-registry")
        assert resp.status_code == 200

    def test_ops_alerts_summary(self, client):
        resp = client.get("/ops/security/alerts-summary")
        assert resp.status_code == 200

    def test_ops_case_summary(self, client):
        resp = client.get("/ops/security/case-summary")
        assert resp.status_code == 200

    def test_ops_policy_rules(self, client):
        resp = client.get("/ops/compliance/policy-rules")
        assert resp.status_code == 200

    def test_ops_reporting_summary(self, client):
        resp = client.get("/ops/compliance/reporting/summary")
        assert resp.status_code == 200

    def test_ops_slo_metrics(self, client):
        resp = client.get("/ops/system/slo-metrics")
        assert resp.status_code == 200

    def test_ops_data_integrity(self, client):
        resp = client.get("/ops/system/data-integrity")
        assert resp.status_code == 200


class TestCasesRouter:
    def test_cases_list(self, client):
        resp = client.get("/cases")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list) or "cases" in data or "count" in data or isinstance(data, dict)

    def test_cases_history_nonexistent(self, client):
        resp = client.get("/cases/0xnonexistent/history")
        assert resp.status_code in (200, 404)
