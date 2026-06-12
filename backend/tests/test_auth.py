def test_register_and_login_success(client):
    # Register a new user (first time)
    payload = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "StrongPass123",
        "wallet_address": None,
    }
    resp = client.post("/auth/_legacy_/register", json=payload)
    assert resp.status_code == 201, f"Register failed: {resp.text}"
    data = resp.json()
    assert data["username"] == "testuser"
    assert data["email"] == "test@example.com"

    # Login with correct credentials
    login_resp = client.post("/auth/login", data={"username": "testuser", "password": "StrongPass123"})
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token_data = login_resp.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"

def test_register_duplicate_username_fails(client):
    # Attempt to register with the same username again
    payload = {
        "username": "testuser",
        "email": "another@example.com",
        "password": "AnotherPass123",
        "wallet_address": None,
    }
    resp = client.post("/auth/_legacy_/register", json=payload)
    # Expect 400 Bad Request because username already exists
    assert resp.status_code == 400, f"Duplicate username should be rejected: {resp.text}"
    assert "Username already registered" in resp.text
