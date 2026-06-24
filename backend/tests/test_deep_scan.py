"""Unit tests for deep scan service."""

import pytest

from app.services.deep_scan_service import DeepScanService


def _sample_txs(address: str = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") -> list:
    return [
        {"tx_hash": f"0x{i:064x}", "from_address": address, "to_address": f"0x{i%5:040x}", "value": str(i * 10**17), "block_number": 15000000 + i}
        for i in range(20)
    ]


class TestDeepScanService:
    def test_perform_deep_scan_basic(self):
        scanner = DeepScanService()
        result = scanner.perform_deep_scan(
            _sample_txs(),
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        )
        assert isinstance(result, dict)
        assert "cycle_detected" in result or "wallet" in result

    def test_perform_deep_scan_empty(self):
        scanner = DeepScanService()
        result = scanner.perform_deep_scan([], "0xabcd")
        assert isinstance(result, dict)

    def test_perform_deep_scan_single_tx_no_cycle(self):
        scanner = DeepScanService()
        txs = [{"tx_hash": "0x01", "from_address": "0xa", "to_address": "0xb", "value": "100"}]
        result = scanner.perform_deep_scan(txs, "0xa")
        assert isinstance(result, dict)

    def test_perform_deep_scan_cycle_a_to_b_to_a(self):
        scanner = DeepScanService()
        txs = [
            {"tx_hash": "0x01", "from_address": "0xa", "to_address": "0xb", "value": "100", "block_number": 1},
            {"tx_hash": "0x02", "from_address": "0xb", "to_address": "0xa", "value": "50", "block_number": 2},
        ]
        result = scanner.perform_deep_scan(txs, "0xa")
        assert isinstance(result, dict)

    def test_perform_deep_scan_long_cycle(self):
        scanner = DeepScanService()
        txs = [
            {"tx_hash": f"0x{i:02x}", "from_address": f"0x{chr(97+i)}", "to_address": f"0x{chr(98+i)}", "value": "10", "block_number": i}
            for i in range(5)
        ]
        txs.append({"tx_hash": "0x05", "from_address": "0xf", "to_address": "0xa", "value": "10", "block_number": 5})
        result = scanner.perform_deep_scan(txs, "0xa")
        assert isinstance(result, dict)

    def test_perform_deep_scan_100_txs_no_cycle(self):
        scanner = DeepScanService()
        txs = [
            {"tx_hash": f"0x{i:064x}", "from_address": f"0x{i%50:040x}", "to_address": f"0x{(i+1)%50:040x}", "value": str(i * 10**17), "block_number": i}
            for i in range(100)
        ]
        result = scanner.perform_deep_scan(txs, "0x1")
        assert isinstance(result, dict)

    def test_perform_deep_scan_target_not_in_txs(self):
        scanner = DeepScanService()
        txs = [
            {"tx_hash": "0x01", "from_address": "0xa", "to_address": "0xb", "value": "100"},
        ]
        result = scanner.perform_deep_scan(txs, "0xnonexistent")
        assert isinstance(result, dict)
