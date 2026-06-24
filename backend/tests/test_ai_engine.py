"""Unit tests for AI detection engine (MultiAgentDetectionEngine, MLRiskPredictor)."""

import pytest
from unittest.mock import MagicMock, patch

from app.services.ai_engine import MultiAgentDetectionEngine, MLRiskPredictor


def _sample_transactions(count: int = 10, base_address: str = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") -> list:
    return [
        {
            "tx_hash": f"0x{i:064x}",
            "from_address": base_address if i % 2 == 0 else f"0x{i%10:040x}",
            "to_address": f"0x{(i+1)%10:040x}" if i % 2 == 0 else base_address,
            "value": str((i + 1) * 10**17),
            "block_number": 15000000 + i,
            "timestamp": "2025-01-01T00:00:00Z",
            "gas_price": "1000000000",
            "gas_used": 21000,
            "status": 1,
            "chain_id": "ethereum",
        }
        for i in range(count)
    ]


def _empty_transactions() -> list:
    return []


class TestMLRiskPredictor:
    def test_ml_predictor_singleton(self):
        instance1 = MLRiskPredictor()
        instance2 = MLRiskPredictor()
        assert instance1 is instance2

    def test_ml_predictor_no_model_returns_fallback(self):
        MLRiskPredictor._initialized = False
        with patch.object(MLRiskPredictor, "_load_model_artifacts", return_value=None):
            predictor = MLRiskPredictor()
            result = predictor.predict_risk("0xabcd", _sample_transactions(5))
            assert result["ml_available"] is False
            assert result["ml_score"] == 0.0
        MLRiskPredictor._initialized = False

    def test_ml_predictor_empty_transactions_returns_fallback(self):
        MLRiskPredictor._initialized = False
        predictor = MLRiskPredictor()
        result = predictor.predict_risk("0xabcd", _empty_transactions())
        assert result["ml_available"] is False
        assert "no transactions" in result["ml_reason"].lower()
        MLRiskPredictor._initialized = False

    def test_ml_predictor_empty_address_returns_fallback(self):
        MLRiskPredictor._initialized = False
        with patch.object(MLRiskPredictor, "_load_model_artifacts", return_value=None):
            predictor = MLRiskPredictor()
            result = predictor.predict_risk("", _sample_transactions(3))
            assert result["ml_available"] is False
        MLRiskPredictor._initialized = False


class TestMultiAgentDetectionEngine:
    def test_analyze_wallet_empty_transactions(self):
        engine = MultiAgentDetectionEngine()
        result = engine.analyze_wallet("0xabcd", _empty_transactions())
        assert "total_score" in result
        assert result["total_score"] >= 0.0
        assert "risk_level" in result

    def test_analyze_wallet_normal_transactions(self):
        engine = MultiAgentDetectionEngine()
        result = engine.analyze_wallet(
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            _sample_transactions(20),
            wallet_age_days=100,
        )
        assert "total_score" in result
        assert "risk_level" in result
        assert "breakdown" in result
        assert "ml_prediction" in result["breakdown"]
        assert "money_laundering" in result["breakdown"]
        assert "wash_trading" in result["breakdown"]
        assert "scam" in result["breakdown"]

    def test_analyze_wallet_invalid_address(self):
        engine = MultiAgentDetectionEngine()
        result = engine.analyze_wallet("invalid", _sample_transactions(5))
        assert result["total_score"] >= 0

    def test_detect_money_laundering_no_outgoing(self):
        engine = MultiAgentDetectionEngine()
        # All transactions are incoming (from_address != target)
        txs = [
            {
                "tx_hash": "0xaa",
                "from_address": "0xbb",
                "to_address": "0xcc",
                "value": "100",
            }
        ]
        result = engine.detect_money_laundering(txs, "0xcc")
        assert result["detected"] is False
        assert len(result["reasons"]) == 0

    def test_detect_wash_trading(self):
        engine = MultiAgentDetectionEngine()
        txs = _sample_transactions(10)
        result = engine.detect_wash_trading(txs, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
        assert "detected" in result
        assert "confidence" in result

    def test_detect_scam_behavior_none(self):
        engine = MultiAgentDetectionEngine()
        txs = _sample_transactions(5)
        result = engine.detect_scam_behavior(txs, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", wallet_age_days=100)
        assert "detected" in result

    def test_aggregate_risk_all_zero(self):
        engine = MultiAgentDetectionEngine()
        result = engine.aggregate_risk(
            laundering_result={"detected": False, "confidence": 0.0, "reasons": []},
            wt_result={"detected": False, "confidence": 0.0, "reasons": []},
            scam_result={"detected": False, "confidence": 0.0, "reasons": []},
            ml_prediction={"ml_score": 0.0, "ml_confidence": 0.0, "ml_available": False, "ml_reason": "n/a"},
            transactions=[],
        )
        assert result["total_score"] == 0.0
        assert result["risk_level"] == "LOW"

    def test_aggregate_risk_high(self):
        engine = MultiAgentDetectionEngine()
        result = engine.aggregate_risk(
            laundering_result={"detected": True, "confidence": 0.9, "reasons": ["mixer"]},
            wt_result={"detected": True, "confidence": 0.8, "reasons": ["cycle"]},
            scam_result={"detected": True, "confidence": 0.7, "reasons": ["honeypot"]},
            ml_prediction={"ml_score": 85.0, "ml_confidence": 0.9, "ml_available": True, "ml_reason": "ml high"},
            transactions=_sample_transactions(10),
        )
        assert result["total_score"] > 50
        assert result["risk_level"] in ("HIGH", "CRITICAL")

    def test_analyze_wallet_wallet_not_found_handled(self):
        engine = MultiAgentDetectionEngine(database_session=MagicMock())
        result = engine.analyze_wallet("0xnonexistent", _sample_transactions(5))
        assert result["total_score"] >= 0
        assert "breakdown" in result

    def test_analyze_wallet_null_address(self):
        engine = MultiAgentDetectionEngine()
        result = engine.analyze_wallet(None, _sample_transactions(3))
        assert result["total_score"] >= 0

    def test_analyze_wallet_extreme_values(self):
        engine = MultiAgentDetectionEngine()
        txs = [
            {
                "tx_hash": "0xextreme",
                "from_address": "0xtarget00000000000000000000000000000000000",
                "to_address": "0xother000000000000000000000000000000000000",
                "value": str(10**30),
                "block_number": 1,
                "timestamp": "2025-01-01T00:00:00Z",
                "gas_price": "1",
                "gas_used": 21000,
                "status": 1,
                "chain_id": "ethereum",
            }
        ]
        result = engine.analyze_wallet("0xtarget00000000000000000000000000000000000", txs)
        assert "total_score" in result

    def test_detect_money_laundering_round_amounts(self):
        engine = MultiAgentDetectionEngine()
        txs = [
            {
                "tx_hash": f"0x{i:064x}",
                "from_address": "0xtarget00000000000000000000000000000000000",
                "to_address": f"0x{i%10:040x}",
                "value": str(10**18),
                "block_number": 100,
                "timestamp": "2025-01-01T00:00:00Z",
                "gas_price": "1",
                "gas_used": 21000,
                "status": 1,
                "chain_id": "ethereum",
            }
            for i in range(5)
        ]
        result = engine.detect_money_laundering(txs, "0xtarget00000000000000000000000000000000000")
        assert "detected" in result

    def test_detect_wash_trading_self_cycle(self):
        engine = MultiAgentDetectionEngine()
        txs = [
            {
                "tx_hash": "0xcycle1",
                "from_address": "0xa",
                "to_address": "0xb",
                "value": "100",
                "block_number": 1,
                "timestamp": "2025-01-01T00:00:00Z",
                "gas_price": "1",
                "gas_used": 21000,
                "status": 1,
                "chain_id": "ethereum",
            },
            {
                "tx_hash": "0xcycle2",
                "from_address": "0xb",
                "to_address": "0xa",
                "value": "100",
                "block_number": 2,
                "timestamp": "2025-01-01T00:00:00Z",
                "gas_price": "1",
                "gas_used": 21000,
                "status": 1,
                "chain_id": "ethereum",
            },
        ]
        result = engine.detect_wash_trading(txs, "0xa")
        assert "detected" in result

    def test_aggregate_risk_all_detected(self):
        engine = MultiAgentDetectionEngine()
        result = engine.aggregate_risk(
            laundering_result={"detected": True, "confidence": 0.5, "reasons": ["test"]},
            wt_result={"detected": False, "confidence": 0.0, "reasons": []},
            scam_result={"detected": True, "confidence": 0.6, "reasons": ["test"]},
            ml_prediction={"ml_score": 30.0, "ml_confidence": 0.5, "ml_available": True, "ml_reason": "ml test"},
            transactions=[],
        )
        assert result["total_score"] > 0

    def test_detect_scam_behavior_very_new_wallet(self):
        engine = MultiAgentDetectionEngine()
        txs = _sample_transactions(3)
        result = engine.detect_scam_behavior(txs, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", wallet_age_days=0)
        assert "detected" in result
        assert "confidence" in result
