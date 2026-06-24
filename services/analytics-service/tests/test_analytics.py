from fastapi.testclient import TestClient
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
os.environ['DISABLE_REDIS'] = 'true'
os.environ['DATABASE_URL'] = 'sqlite://'

from main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_dashboard_stats():
    response = client.get("/stats/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert "total_wallets" in data
    assert "total_alerts" in data
