"""Configuration constants for the backend application."""

import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from dotenv import load_dotenv

load_dotenv()


def _default_database_url() -> str:
    """Return environment-appropriate default database URL."""
    # Hugging Face Spaces exposes SPACE_ID and provides persistent storage at /data.
    if os.getenv("SPACE_ID"):
        return "sqlite:////data/blockchain_local.db"
    return "postgresql://user:password@db:5432/blockchain_db"


def _normalize_database_url(raw_url: str) -> str:
    """Strip quotes and provider-specific query parameters that psycopg2 cannot parse."""
    if not raw_url:
        return raw_url

    cleaned_url = raw_url.strip().strip('"').strip("'")

    if cleaned_url.startswith("postgres://"):
        cleaned_url = "postgresql://" + cleaned_url[len("postgres://"):]

    if not cleaned_url.startswith("postgresql://"):
        return cleaned_url

    parsed = urlsplit(cleaned_url)
    if not parsed.query:
        return cleaned_url

    allowed_query_keys = {"sslmode", "connect_timeout", "application_name", "target_session_attrs", "options"}
    filtered_query = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        if key in allowed_query_keys and value
    ]

    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(filtered_query), parsed.fragment))

# API Configuration
ETHERSCAN_API_KEY: str = os.getenv("ETHERSCAN_API_KEY", "")
ETHERSCAN_BASE_URL: str = "https://api.etherscan.io/v2/api"
ETHERSCAN_CHAIN_ID: int = 1  # Ethereum Mainnet
ETHERSCAN_REQUEST_TIMEOUT: int = 10

# Alchemy Configuration
ALCHEMY_API_KEY: str = os.getenv("ALCHEMY_API_KEY", "")
ALCHEMY_RPC_URL: str = f"https://eth-mainnet.g.alchemy.com/v2/{ALCHEMY_API_KEY}"
ALCHEMY_REQUEST_TIMEOUT: int = 15
ALCHEMY_MAX_RETRIES: int = 3
ALCHEMY_RETRY_DELAY: int = 2

# Database Configuration
DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    _default_database_url()
)
DATABASE_URL = _normalize_database_url(DATABASE_URL)

# Model Paths
MODEL_DIRECTORY: str = "app/services"
RISK_MODEL_FILENAME: str = "risk_model.pkl"
SCALER_FILENAME: str = "scaler.pkl"
FEATURES_FILENAME: str = "model_features.pkl"

# Dataset Configuration
DATASET_PATH: str = "transaction_dataset.csv"
TEST_SPLIT_RATIO: float = 0.2
RANDOM_SEED: int = 42

# Risk Thresholds
RISK_THRESHOLD_LOW: int = 20
RISK_THRESHOLD_MEDIUM: int = 50
RISK_THRESHOLD_HIGH: int = 80

# Gemini AI Studio (Generative Language API)
# Prefer GEMINI_API_KEY for explicitness; allow GOOGLE_API_KEY as compatibility alias.
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "") or os.getenv("GOOGLE_API_KEY", "")
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_API_BASE_URL: str = os.getenv("GEMINI_API_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
GEMINI_REQUEST_TIMEOUT_SECONDS: int = int(os.getenv("GEMINI_REQUEST_TIMEOUT_SECONDS", "45"))

# Legacy HF settings (kept for backward compatibility with older diagnostics payloads/docs).
HF_API_TOKEN: str = os.getenv("HF_TOKEN", "")
