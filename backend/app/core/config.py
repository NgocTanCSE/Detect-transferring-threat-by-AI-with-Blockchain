"""Configuration constants for the backend application."""

import os
from dotenv import load_dotenv

load_dotenv()

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
    "postgresql://user:password@db:5432/blockchain_db"
)

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
