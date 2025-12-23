"""Etherscan API integration service for fetching blockchain transaction data."""

import logging
from datetime import datetime
from typing import List, Dict, Any

import requests

from app.core.config import (
    ETHERSCAN_API_KEY,
    ETHERSCAN_BASE_URL,
    ETHERSCAN_CHAIN_ID,
    ETHERSCAN_REQUEST_TIMEOUT
)

logger = logging.getLogger(__name__)


def fetch_transactions(wallet_address: str, transaction_limit: int = 50) -> List[Dict[str, Any]]:
    """
    Retrieve transaction history for a given Ethereum wallet address.

    Args:
        wallet_address: Ethereum wallet address to query
        transaction_limit: Maximum number of transactions to retrieve

    Returns:
        List of transaction dictionaries with standardized fields

    Raises:
        requests.exceptions.RequestException: If API request fails
    """
    if not ETHERSCAN_API_KEY:
        raise RuntimeError("ETHERSCAN_API_KEY not configured")

    request_params = {
        "chainid": ETHERSCAN_CHAIN_ID,
        "module": "account",
        "action": "txlist",
        "address": wallet_address,
        "startblock": 0,
        "endblock": 99999999,
        "page": 1,
        "offset": transaction_limit,
        "sort": "desc",
        "apikey": ETHERSCAN_API_KEY
    }

    try:
        api_response = requests.get(
            ETHERSCAN_BASE_URL,
            params=request_params,
            timeout=ETHERSCAN_REQUEST_TIMEOUT
        )
        api_response.raise_for_status()
        response_data = api_response.json()

        if response_data.get("status") == "0" and response_data.get("message") == "No transactions found":
            return []

        if response_data.get("status") != "1":
            error_message = response_data.get("result", "Unknown API error")
            raise requests.exceptions.RequestException(f"Etherscan API error: {error_message}")

        return [
            _transform_transaction(tx_raw, wallet_address)
            for tx_raw in response_data.get("result", [])
        ]

    except requests.exceptions.RequestException as request_error:
        logger.error(f"Etherscan API request failed: {request_error}")
        raise


def _transform_transaction(raw_transaction: Dict[str, Any], wallet_address: str) -> Dict[str, Any]:
    """Transform raw Etherscan transaction data to internal format."""
    return {
        "tx_hash": raw_transaction["hash"],
        "from_address": raw_transaction["from"],
        "to_address": raw_transaction["to"] or "",
        "value": int(raw_transaction["value"]),
        "block_number": int(raw_transaction["blockNumber"]),
        "timestamp": datetime.fromtimestamp(int(raw_transaction["timeStamp"])),
        "gas_price": int(raw_transaction["gasPrice"]),
        "gas_used": int(raw_transaction["gasUsed"]),
        "input_data": raw_transaction["input"]
    }
