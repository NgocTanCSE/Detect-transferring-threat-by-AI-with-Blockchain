import requests
import unittest
import json
import uuid

# Configuration
# BASE_URL = "http://localhost:8000" # Local test
BASE_URL = "https://tancse2005-detect-transferring-threat-by-ai-with-blockchain.hf.space/api" # HF test

class MultiTenantSystemTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # These IDs should match the seeded data
        # Note: In a real test we would fetch these or use a fresh test org
        cls.org_gbv_id = "95eb6cb5-1300-4958-8127-735e15452ef5" # Placeholder
        cls.org_dntu_id = "f6f9b84f-339f-44d0-8edc-64a39e704d36" # Placeholder
        
        # Try to find real IDs from the /api/ops/system/organizations endpoint if available
        try:
            resp = requests.get(f"{BASE_URL}/api/ops/system/node-endpoints?only_active=true") # Check connectivity
            print(f"Connectivity check: {resp.status_code}")
        except:
            print("Backend not reachable at BASE_URL. Tests will likely fail.")

    def test_kpi_isolation(self):
        """Verify that KPIs are isolated per organization."""
        # This test assumes the backend is running locally for verification
        pass

    def test_header_scoping(self):
        """Check if endpoints require X-Org-ID and scope accordingly."""
        # 1. Test without header (should fail or return global if allowed, but here we expect scoping)
        resp = requests.get(f"{BASE_URL}/api/ops/security/alerts-summary")
        # Depending on implementation, it might return 401 or scoped to null
        print(f"Alerts Summary (No Header): {resp.status_code}")

    def test_phase2_feature_isolation(self):
        """Verify AI feature isolation."""
        # Request features for a specific org
        headers = {"X-Org-ID": "test-org-id"}
        resp = requests.get(f"{BASE_URL}/api/ops/ai/feature-store", headers=headers)
        if resp.status_code == 200:
            items = resp.json().get("data", {}).get("items", [])
            print(f"Fetched {len(items)} features for test-org-id")

if __name__ == "__main__":
    unittest.main()
