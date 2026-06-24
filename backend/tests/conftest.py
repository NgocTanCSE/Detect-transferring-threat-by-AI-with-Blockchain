import os
import pytest
from fastapi.testclient import TestClient

# Use a temporary SQLite DB for tests – ensure a clean file each CI run.
os.environ["DATABASE_URL"] = "sqlite:////tmp/test_db.sqlite"
os.environ["AUTH_DISABLED"] = "false"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-pytest-only-32chars+"

# Import the FastAPI app **after** env vars are set so that the DB engine picks it up.
from app.main import app

@pytest.fixture(scope="session")
def client() -> TestClient:
    """TestClient fixture for the whole test session."""
    return TestClient(app)
