"""Unit tests for feature extractor."""

import pytest
import pandas as pd

from app.services.feature_extractor import extract_transaction_features


def _sample_txs(address: str = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") -> list:
    return [
        {
            "tx_hash": f"0x{i:064x}",
            "from_address": address if i % 2 == 0 else f"0x{i%5:040x}",
            "to_address": f"0x{(i+1)%5:040x}" if i % 2 == 0 else address,
            "value": str((i + 1) * 10**17),
            "block_number": 15000000 + i,
            "timestamp": "2025-01-01T00:00:00Z",
            "gas_price": "1000000000",
            "gas_used": 21000,
            "status": 1,
            "chain_id": "ethereum",
        }
        for i in range(10)
    ]


class TestFeatureExtractor:
    def test_extract_features_basic(self):
        df = extract_transaction_features(
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            _sample_txs(),
        )
        assert isinstance(df, pd.DataFrame)
        assert not df.empty
        # Every column should be numeric or boolean
        for col in df.columns:
            assert pd.api.types.is_numeric_dtype(df[col]) or pd.api.types.is_bool_dtype(df[col]), f"Column {col} is not numeric"

    def test_extract_features_empty(self):
        df = extract_transaction_features("0xabcd", [])
        assert isinstance(df, pd.DataFrame)
        # Even with no transactions, the function should return a single-row DataFrame with defaults
        assert df.shape[0] == 1

    def test_extract_features_no_transactions_for_target(self):
        # All transactions involve a different address
        txs = [
            {"tx_hash": "0x01", "from_address": "0xbb", "to_address": "0xcc", "value": "100", "block_number": 1, "gas_price": "1", "gas_used": 21000, "status": 1, "chain_id": "ethereum", "timestamp": "2025-01-01T00:00:00Z"},
        ]
        df = extract_transaction_features("0xaa", txs)
        assert isinstance(df, pd.DataFrame)
        assert df.shape[0] == 1
        # Incoming and outgoing should both be zero
        total_out = df.get("total_outgoing_eth", pd.Series([0])).iloc[0]
        total_in = df.get("total_incoming_eth", pd.Series([0])).iloc[0]
        assert total_out == 0.0
        assert total_in == 0.0

    def test_extract_features_1000_transactions(self):
        address = "0xtarget1000000000000000000000000000000000000"
        txs = [
            {
                "tx_hash": f"0x{i:064x}",
                "from_address": address if i % 2 == 0 else f"0x{i%100:040x}",
                "to_address": f"0x{(i+1)%100:040x}" if i % 2 == 0 else address,
                "value": str((i + 1) * 10**17),
                "block_number": 15000000 + i,
                "timestamp": "2025-01-01T00:00:00Z",
                "gas_price": "1000000000",
                "gas_used": 21000,
                "status": 1,
                "chain_id": "ethereum",
            }
            for i in range(1000)
        ]
        df = extract_transaction_features(address, txs)
        assert isinstance(df, pd.DataFrame)
        assert df.shape[0] == 1
        total_cols = len(df.columns)
        assert total_cols > 0

    def test_extract_features_mixed_chains(self):
        address = "0xtargetmix000000000000000000000000000000000"
        txs = [
            {
                "tx_hash": f"0x{i:064x}",
                "from_address": address if i % 2 == 0 else "0xother",
                "to_address": "0xother" if i % 2 == 0 else address,
                "value": "100",
                "block_number": 1,
                "timestamp": "2025-01-01T00:00:00Z",
                "gas_price": "1",
                "gas_used": 21000,
                "status": 1,
                "chain_id": "ethereum" if i % 2 == 0 else "bsc",
            }
            for i in range(10)
        ]
        df = extract_transaction_features(address, txs)
        assert isinstance(df, pd.DataFrame)

    def test_extract_features_zero_values(self):
        address = "0xzerotarget00000000000000000000000000000000"
        txs = [
            {
                "tx_hash": "0xzero1",
                "from_address": address,
                "to_address": "0xother",
                "value": "0",
                "block_number": 1,
                "timestamp": "2025-01-01T00:00:00Z",
                "gas_price": "0",
                "gas_used": 0,
                "status": 0,
                "chain_id": "ethereum",
            }
        ]
        df = extract_transaction_features(address, txs)
        assert isinstance(df, pd.DataFrame)

    def test_extract_features_null_fields(self):
        address = "0xnulltarget000000000000000000000000000000000"
        txs = [
            {
                "tx_hash": None,
                "from_address": None,
                "to_address": None,
                "value": None,
                "block_number": None,
                "gas_price": None,
                "gas_used": None,
                "status": None,
                "chain_id": None,
                "timestamp": None,
            }
        ]
        df = extract_transaction_features(address, txs)
        assert isinstance(df, pd.DataFrame)
        assert df.shape[0] == 1
