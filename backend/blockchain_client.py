"""Alchemy blockchain data client for Ethereum transaction history retrieval."""

import logging
import time
from typing import List, Dict, Any, Optional
from datetime import datetime

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from app.core.config import (
    ALCHEMY_API_KEY,
    ALCHEMY_RPC_URL,
    ALCHEMY_REQUEST_TIMEOUT,
    ALCHEMY_MAX_RETRIES,
    ALCHEMY_RETRY_DELAY
)

logger = logging.getLogger(__name__)


class AlchemyClient:
    """
    Production-grade Alchemy API client for blockchain data retrieval.

    Uses alchemy_getAssetTransfers for efficient transaction history fetching,
    significantly faster than iterating through individual transactions.
    """

    def __init__(self):
        self.rpc_url = ALCHEMY_RPC_URL
        self.session = self._create_session_with_retries()

        if not ALCHEMY_API_KEY:
            logger.warning("Alchemy API key not configured")

    def _create_session_with_retries(self) -> requests.Session:
        """Create HTTP session with automatic retry logic."""
        session = requests.Session()

        retry_strategy = Retry(
            total=ALCHEMY_MAX_RETRIES,
            backoff_factor=ALCHEMY_RETRY_DELAY,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["POST"]
        )

        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("https://", adapter)
        session.mount("http://", adapter)

        return session

    def _make_rpc_call(self, method: str, params: List[Any]) -> Dict[str, Any]:
        """
        Execute JSON-RPC call to Alchemy endpoint.

        Args:
            method: RPC method name
            params: Method parameters

        Returns:
            RPC response data

        Raises:
            requests.exceptions.RequestException: If request fails after retries
        """
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": 1
        }

        try:
            response = self.session.post(
                self.rpc_url,
                json=payload,
                timeout=ALCHEMY_REQUEST_TIMEOUT,
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()

            data = response.json()

            if "error" in data:
                error_msg = data["error"].get("message", "Unknown RPC error")
                raise ValueError(f"Alchemy RPC error: {error_msg}")

            return data.get("result", {})

        except requests.exceptions.RequestException as request_error:
            logger.error(f"Alchemy RPC request failed: {request_error}")
            raise

    def fetch_wallet_history(
        self,
        wallet_address: str,
        category: Optional[List[str]] = None,
        max_count: int = 1000
    ) -> List[Dict[str, Any]]:
        """
        Retrieve comprehensive transaction history for a wallet address.

        Uses Alchemy's `alchemy_getAssetTransfers` method which aggregates:
        - External ETH transfers
        - ERC20 token transfers
        - ERC721/ERC1155 NFT transfers

        Args:
            wallet_address: Ethereum address to query
            category: Transfer types to include (default: external + erc20)
            max_count: Maximum transactions to retrieve

        Returns:
            List of normalized transaction dictionaries
        """
        if category is None:
            category = ["external", "erc20", "erc721", "erc1155"]

        normalized_address = wallet_address.lower()
        all_transfers = []

        # Fetch outgoing transfers (fromAddress)
        outgoing = self._fetch_transfers(
            from_address=normalized_address,
            category=category,
            max_count=max_count // 2
        )
        all_transfers.extend(outgoing)

        # Fetch incoming transfers (toAddress)
        incoming = self._fetch_transfers(
            to_address=normalized_address,
            category=category,
            max_count=max_count // 2
        )
        all_transfers.extend(incoming)

        # Deduplicate by transaction hash
        unique_transfers = {
            transfer["hash"]: transfer for transfer in all_transfers
        }.values()

        # Sort by block number descending (most recent first)
        sorted_transfers = sorted(
            unique_transfers,
            key=lambda x: x.get("blockNumber", 0),
            reverse=True
        )

        return list(sorted_transfers)[:max_count]

    def _fetch_transfers(
        self,
        category: List[str],
        from_address: Optional[str] = None,
        to_address: Optional[str] = None,
        max_count: int = 500
    ) -> List[Dict[str, Any]]:
        """
        Fetch asset transfers with specified filters.

        Args:
            category: Types of transfers to fetch
            from_address: Filter by sender address
            to_address: Filter by receiver address
            max_count: Maximum results to return

        Returns:
            List of raw transfer objects from Alchemy
        """
        params = [{
            "fromBlock": "0x0",
            "toBlock": "latest",
            "category": category,
            "withMetadata": True,
            "excludeZeroValue": False,
            "maxCount": hex(max_count)
        }]

        if from_address:
            params[0]["fromAddress"] = from_address
        if to_address:
            params[0]["toAddress"] = to_address

        try:
            result = self._make_rpc_call("alchemy_getAssetTransfers", params)
            transfers = result.get("transfers", [])

            logger.info(
                f"Fetched {len(transfers)} transfers for "
                f"{'from' if from_address else 'to'} address"
            )

            return [self._normalize_transfer(t) for t in transfers]

        except Exception as fetch_error:
            logger.error(f"Failed to fetch transfers: {fetch_error}")
            return []

    def _normalize_transfer(self, raw_transfer: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform Alchemy transfer object to internal format.

        Args:
            raw_transfer: Raw transfer data from Alchemy

        Returns:
            Normalized transaction dictionary matching our schema
        """
        metadata = raw_transfer.get("metadata", {})

        # Convert hex block number to integer
        block_num = raw_transfer.get("blockNum", "0x0")
        block_number = int(block_num, 16) if isinstance(block_num, str) else block_num

        # Parse timestamp from metadata
        timestamp_str = metadata.get("blockTimestamp")
        if timestamp_str:
            timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        else:
            timestamp = datetime.utcnow()

        # Convert value to Wei (handle both ETH and token decimals)
        value_raw = raw_transfer.get("value", 0)
        if isinstance(value_raw, (int, float)):
            value_wei = int(value_raw * 10**18)
        else:
            value_wei = 0

        return {
            "tx_hash": raw_transfer.get("hash", ""),
            "from_address": raw_transfer.get("from", "").lower(),
            "to_address": raw_transfer.get("to", "").lower() if raw_transfer.get("to") else None,
            "value": value_wei,
            "block_number": block_number,
            "timestamp": timestamp,
            "category": raw_transfer.get("category", "external"),
            "asset": raw_transfer.get("asset"),
            "token_id": raw_transfer.get("tokenId"),
            "gas_price": 0,  # Not provided by getAssetTransfers
            "gas_used": 0,
            "input_data": "0x"
        }


# Global client instance
_alchemy_client: Optional[AlchemyClient] = None


def get_alchemy_client() -> AlchemyClient:
    """Get or create singleton Alchemy client instance."""
    global _alchemy_client

    if _alchemy_client is None:
        _alchemy_client = AlchemyClient()

    return _alchemy_client


def fetch_wallet_history(
    wallet_address: str,
    max_count: int = 100
) -> List[Dict[str, Any]]:
    """
    Convenience function to fetch wallet transaction history.

    Args:
        wallet_address: Ethereum wallet address
        max_count: Maximum transactions to retrieve

    Returns:
        List of normalized transactions
    """
    client = get_alchemy_client()
    return client.fetch_wallet_history(wallet_address, max_count=max_count)
