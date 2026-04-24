"""Blockchain data client factory for multi-chain transaction history retrieval."""

import logging
import time
from typing import List, Dict, Any, Optional
from datetime import datetime
from abc import ABC, abstractmethod

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from app.core.config import (
    ALCHEMY_API_KEY,
    ALCHEMY_ETH_RPC_URL,
    ALCHEMY_BSC_RPC_URL,
    ALCHEMY_REQUEST_TIMEOUT,
    ALCHEMY_MAX_RETRIES,
    ALCHEMY_RETRY_DELAY
)

logger = logging.getLogger(__name__)

class BlockchainClient(ABC):
    """Abstract base class for blockchain data clients."""

    @abstractmethod
    def fetch_wallet_history(self, wallet_address: str, max_count: int = 1000) -> List[Dict[str, Any]]:
        pass

class AlchemyClient(BlockchainClient):
    """
    Production-grade Alchemy API client for blockchain data retrieval.
    Supports multiple chains via RPC URL configuration.
    """

    def __init__(self, rpc_url: str, chain_name: str):
        self.rpc_url = rpc_url
        self.chain_name = chain_name
        self.session = self._create_session_with_retries()

        if not ALCHEMY_API_KEY:
            logger.warning(f"Alchemy API key not configured for {chain_name}")

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
                raise ValueError(f"Alchemy RPC error ({self.chain_name}): {error_msg}")
            return data.get("result", {})
        except Exception as e:
            logger.error(f"Alchemy RPC request failed for {self.chain_name}: {e}")
            raise

    def fetch_wallet_history(self, wallet_address: str, max_count: int = 1000) -> List[Dict[str, Any]]:
        category = ["external", "erc20", "erc721", "erc1155"]
        normalized_address = wallet_address.lower()
        all_transfers = []

        # Fetch outgoing and incoming
        all_transfers.extend(self._fetch_transfers(from_address=normalized_address, category=category, max_count=max_count // 2))
        all_transfers.extend(self._fetch_transfers(to_address=normalized_address, category=category, max_count=max_count // 2))

        # Deduplicate
        dedup_map: Dict[str, Dict[str, Any]] = {}
        for transfer in all_transfers:
            tx_hash = transfer.get("tx_hash")
            if tx_hash:
                dedup_map[tx_hash] = transfer

        sorted_transfers = sorted(dedup_map.values(), key=lambda x: x.get("block_number", 0), reverse=True)
        return list(sorted_transfers)[:max_count]

    def _fetch_transfers(self, category: List[str], from_address: Optional[str] = None, to_address: Optional[str] = None, max_count: int = 500) -> List[Dict[str, Any]]:
        params = [{
            "fromBlock": "0x0",
            "toBlock": "latest",
            "category": category,
            "withMetadata": True,
            "excludeZeroValue": False,
            "maxCount": hex(max_count)
        }]
        if from_address: params[0]["fromAddress"] = from_address
        if to_address: params[0]["toAddress"] = to_address

        try:
            result = self._make_rpc_call("alchemy_getAssetTransfers", params)
            transfers = result.get("transfers", [])
            return [self._normalize_transfer(t) for t in transfers]
        except Exception as e:
            logger.error(f"Failed to fetch transfers for {self.chain_name}: {e}")
            return []

    def _normalize_transfer(self, raw_transfer: Dict[str, Any]) -> Dict[str, Any]:
        metadata = raw_transfer.get("metadata", {})
        block_num = raw_transfer.get("blockNum", "0x0")
        block_number = int(block_num, 16) if isinstance(block_num, str) else block_num

        timestamp_str = metadata.get("blockTimestamp")
        if timestamp_str:
            timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        else:
            timestamp = datetime.utcnow()

        value_raw = raw_transfer.get("value", 0)
        value_wei = int(value_raw * 10**18) if isinstance(value_raw, (int, float)) else 0

        return {
            "tx_hash": raw_transfer.get("hash", ""),
            "from_address": raw_transfer.get("from", "").lower(),
            "to_address": raw_transfer.get("to", "").lower() if raw_transfer.get("to") else None,
            "value": value_wei,
            "block_number": block_number,
            "timestamp": timestamp,
            "category": raw_transfer.get("category", "external"),
            "asset": raw_transfer.get("asset"),
            "chain": self.chain_name
        }


class EthereumAlchemyClient(AlchemyClient):
    """Ethereum-specific Alchemy client."""

    def __init__(self):
        super().__init__(ALCHEMY_ETH_RPC_URL, "ethereum")


class BSCAlchemyClient(AlchemyClient):
    """BSC-specific Alchemy client."""

    def __init__(self):
        super().__init__(ALCHEMY_BSC_RPC_URL, "bsc")

class BlockchainClientFactory:
    """Factory for creating blockchain clients based on chain ID or name."""

    _clients: Dict[str, BlockchainClient] = {}
    _aliases: Dict[str, str] = {
        "ethereum": "ethereum",
        "eth": "ethereum",
        "1": "ethereum",
        "bsc": "bsc",
        "binance": "bsc",
        "bnb": "bsc",
        "56": "bsc",
    }

    @classmethod
    def _resolve_chain(cls, chain: str) -> str:
        key = str(chain or "ethereum").strip().lower()
        canonical_chain = cls._aliases.get(key)
        if canonical_chain:
            return canonical_chain
        raise ValueError(f"Unsupported blockchain: {chain}")

    @classmethod
    def get_client(cls, chain: str = "ethereum") -> BlockchainClient:
        canonical_chain = cls._resolve_chain(chain)

        if canonical_chain not in cls._clients:
            if canonical_chain == "ethereum":
                cls._clients[canonical_chain] = EthereumAlchemyClient()
            elif canonical_chain == "bsc":
                cls._clients[canonical_chain] = BSCAlchemyClient()

        return cls._clients[canonical_chain]

def fetch_wallet_history(wallet_address: str, chain: str = "ethereum", max_count: int = 100) -> List[Dict[str, Any]]:
    """Convenience function using the factory."""
    client = BlockchainClientFactory.get_client(chain)
    return client.fetch_wallet_history(wallet_address, max_count=max_count)
