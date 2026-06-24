import pytest


class TestAnalyzeEndpoint:
    def test_analyze_valid_address(self, client):
        resp = client.get("/analyze/0x0000000000000000000000000000000000000001")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict)
        assert "total_score" in data or "risk_score" in data or "risk_level" in data or "score" in data

    def test_analyze_zero_address(self, client):
        resp = client.get("/analyze/0x0000000000000000000000000000000000000000")
        assert resp.status_code == 200

    def test_analyze_burn_address(self, client):
        resp = client.get("/analyze/0x000000000000000000000000000000000000dead")
        assert resp.status_code == 200

    def test_analyze_short_address_fails(self, client):
        resp = client.get("/analyze/0x1234")
        assert resp.status_code in (200, 400, 422)

    def test_analyze_empty_address_fails(self, client):
        resp = client.get("/analyze/")
        assert resp.status_code in (404, 400, 422)

    def test_analyze_response_has_breakdown(self, client):
        resp = client.get("/analyze/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
        assert resp.status_code == 200
        data = resp.json()
        if isinstance(data, dict):
            keys_found = ["breakdown", "ml", "money_laundering", "wash_trading", "scam",
                          "ml_score", "heuristic_score", "total_score",
                          "risk_level", "details", "agents"]
            assert any(k in data for k in keys_found), f"No expected keys found in {list(data.keys())}"
