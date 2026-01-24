"""Multi-Agent AI Detection Engine for blockchain fraud detection."""

import logging
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple, Optional
from collections import defaultdict

import pandas as pd
import numpy as np
import joblib
from sqlalchemy.orm import Session

from app.services.feature_extractor import extract_transaction_features
from app.core.config import (
    MODEL_DIRECTORY,
    RISK_MODEL_FILENAME,
    SCALER_FILENAME,
    FEATURES_FILENAME
)

logger = logging.getLogger(__name__)


class MLRiskPredictor:
    """
    Machine Learning-based risk predictor using trained Random Forest model.

    Loads the pre-trained model artifacts and provides probability-based
    risk scoring for wallet transaction patterns.
    """

    _instance: Optional['MLRiskPredictor'] = None
    _initialized: bool = False

    def __new__(cls):
        """Singleton pattern to avoid reloading model on each request."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """Load model artifacts on first initialization."""
        if MLRiskPredictor._initialized:
            return

        self.model = None
        self.scaler = None
        self.feature_names = None
        self.is_available = False

        self._load_model_artifacts()
        MLRiskPredictor._initialized = True

    def _load_model_artifacts(self) -> None:
        """Attempt to load trained model, scaler, and feature names."""
        try:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            model_dir = os.path.join(base_dir, MODEL_DIRECTORY)

            model_path = os.path.join(model_dir, RISK_MODEL_FILENAME)
            scaler_path = os.path.join(model_dir, SCALER_FILENAME)
            features_path = os.path.join(model_dir, FEATURES_FILENAME)

            if not all(os.path.exists(p) for p in [model_path, scaler_path, features_path]):
                logger.warning(f"Model artifacts not found in {model_dir}. ML predictions disabled.")
                return

            self.model = joblib.load(model_path)
            self.scaler = joblib.load(scaler_path)
            self.feature_names = joblib.load(features_path)
            self.is_available = True

            logger.info(f"ML model loaded successfully from {model_dir}")
            logger.info(f"Model expects {len(self.feature_names)} features")

        except Exception as e:
            logger.error(f"Failed to load ML model: {e}")
            self.is_available = False

    def predict_risk(
        self,
        wallet_address: str,
        transactions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Predict fraud probability using the trained ML model.

        Args:
            wallet_address: Target wallet address
            transactions: List of transaction dictionaries

        Returns:
            Dictionary with 'ml_score' (0-100), 'ml_confidence', and 'ml_available'
        """
        if not self.is_available or not transactions:
            return {
                'ml_score': 0.0,
                'ml_confidence': 0.0,
                'ml_available': False,
                'ml_reason': 'Model not available or no transactions'
            }

        try:
            # Extract features from transactions
            features_df = extract_transaction_features(wallet_address, transactions)

            # Align features with training schema
            aligned_features = self._align_features(features_df)

            # Scale features
            scaled_features = self.scaler.transform(aligned_features)

            # Predict probability
            fraud_proba = self.model.predict_proba(scaled_features)[0]

            # Index 1 is usually the "fraud" class probability
            fraud_probability = float(fraud_proba[1]) if len(fraud_proba) > 1 else float(fraud_proba[0])

            # Convert to 0-100 score
            ml_score = fraud_probability * 100.0

            # Confidence based on how far from 0.5 (decision boundary)
            confidence = abs(fraud_probability - 0.5) * 2

            logger.info(f"ML prediction for {wallet_address[:10]}...: score={ml_score:.1f}, conf={confidence:.2f}")

            return {
                'ml_score': ml_score,
                'ml_confidence': confidence,
                'ml_available': True,
                'ml_reason': f'Random Forest prediction: {fraud_probability:.2%} fraud probability'
            }

        except Exception as e:
            logger.warning(f"ML prediction failed for {wallet_address}: {e}")
            return {
                'ml_score': 0.0,
                'ml_confidence': 0.0,
                'ml_available': False,
                'ml_reason': f'Prediction error: {str(e)}'
            }

    def _align_features(self, features_df: pd.DataFrame) -> pd.DataFrame:
        """
        Align extracted features with the model's expected feature schema.

        Handles missing columns and extra columns gracefully.
        """
        aligned = pd.DataFrame(columns=self.feature_names)

        for col in self.feature_names:
            if col in features_df.columns:
                aligned[col] = features_df[col].values
            else:
                aligned[col] = 0.0

        # Fill any NaN values
        aligned = aligned.fillna(0.0)

        return aligned


# Known Mixer/Tumbler addresses (lowercase)
KNOWN_MIXERS = {
    '0x722122df12d4e14e13ac3b6895a86e84145b6967',  # Tornado Cash 1
    '0xdd4c48c0b24039969fc16d1cdf626eab821d3384',  # Tornado Cash 2
    '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b',  # Tornado Cash 3
    '0xd96f2b1c14db8458374d9aca76e26c3d18364307',  # Tornado Cash 4
}

# Risk score thresholds
RISK_THRESHOLD_CRITICAL = 90
RISK_THRESHOLD_HIGH = 70
RISK_THRESHOLD_MEDIUM = 50


class MultiAgentDetectionEngine:
    """
    Advanced fraud detection engine using multiple specialized agents.

    Each agent focuses on a specific attack pattern:
    - Money Laundering Agent: Structuring, mixer usage
    - Wash Trading Agent: Cycle detection, bot behavior
    - Scam Agent: Honeypot detection, blacklist matching
    """

    def __init__(self, database_session: Session = None):
        """
        Initialize detection engine with ML predictor.

        Args:
            database_session: Optional SQLAlchemy session for blacklist checking
        """
        self.db_session = database_session
        self.ml_predictor = MLRiskPredictor()
        logger.info(f"Multi-Agent Detection Engine initialized (ML available: {self.ml_predictor.is_available})")

    def analyze_wallet(
        self,
        wallet_address: str,
        transactions: List[Dict[str, Any]],
        wallet_age_days: int = None
    ) -> Dict[str, Any]:
        """
        Perform comprehensive risk analysis on a wallet.

        Args:
            wallet_address: Target wallet address
            transactions: List of transaction dictionaries
            wallet_age_days: Age of wallet in days (optional)

        Returns:
            Detailed risk analysis with breakdown by detection type
        """
        normalized_address = wallet_address.lower()

        # Calculate wallet age if not provided
        if wallet_age_days is None and transactions:
            wallet_age_days = self._calculate_wallet_age(transactions)

        # Run all detection agents
        laundering_result = self.detect_money_laundering(transactions, normalized_address)
        wt_result = self.detect_wash_trading(transactions, normalized_address)
        scam_result = self.detect_scam_behavior(
            transactions,
            normalized_address,
            wallet_age_days or 365
        )

        # Run ML-based prediction
        ml_prediction = self.ml_predictor.predict_risk(normalized_address, transactions)

        # Aggregate risk score (blend heuristics + ML)
        final_risk = self.aggregate_risk(
            laundering_result=laundering_result,
            wt_result=wt_result,
            scam_result=scam_result,
            ml_prediction=ml_prediction,
            transactions=transactions
        )

        logger.info(
            f"Risk analysis complete for {normalized_address[:10]}... "
            f"Score: {final_risk['total_score']} (ML: {ml_prediction.get('ml_score', 0):.1f})"
        )

        return final_risk

    def detect_money_laundering(
        self,
        transactions: List[Dict[str, Any]],
        target_address: str
    ) -> Dict[str, Any]:
        """
        Detect money laundering patterns.

        Patterns detected:
        1. Structuring: Multiple similar-value transactions in short time
        2. Mixer usage: Interaction with known Tornado Cash addresses

        Args:
            transactions: Transaction list
            target_address: Wallet being analyzed

        Returns:
            Detection result with reasons
        """
        detected = False
        reasons = []
        confidence = 0.0

        # Filter outgoing transactions
        outgoing = [
            tx for tx in transactions
            if tx.get('from_address', '').lower() == target_address
        ]

        if not outgoing:
            return {
                'detected': False,
                'confidence': 0.0,
                'reasons': []
            }

        # Pattern 1: Structuring detection
        structuring_detected = self._detect_structuring(outgoing)
        if structuring_detected:
            detected = True
            reasons.append("Structuring: Multiple similar transactions in short timeframe")
            confidence = max(confidence, 0.85)

        # Pattern 2: Mixer interaction
        mixer_detected = self._detect_mixer_usage(outgoing)
        if mixer_detected:
            detected = True
            reasons.append("Mixer Usage: Transactions to Tornado Cash detected")
            confidence = max(confidence, 0.95)

        return {
            'detected': detected,
            'confidence': confidence,
            'reasons': reasons
        }

    def detect_wash_trading(
        self,
        transactions: List[Dict[str, Any]],
        target_address: str
    ) -> Dict[str, Any]:
        """
        Detect wash trading and market manipulation.

        Patterns detected:
        1. Cycle detection: A→B→A patterns
        2. High frequency: Bot-like trading behavior

        Args:
            transactions: Transaction list
            target_address: Wallet being analyzed

        Returns:
            Detection result with reasons
        """
        detected = False
        reasons = []
        confidence = 0.0

        if not transactions:
            return {
                'detected': False,
                'confidence': 0.0,
                'reasons': []
            }

        # Pattern 1: Cycle detection
        cycle_detected = self._detect_cycles(transactions, target_address)
        if cycle_detected:
            detected = True
            reasons.append("Cycle Trading: Reciprocal transactions detected")
            confidence = max(confidence, 0.75)

        # Pattern 2: High frequency trading
        high_freq_detected = self._detect_high_frequency(transactions)
        if high_freq_detected:
            detected = True
            reasons.append("Bot Behavior: Extremely high transaction frequency")
            confidence = max(confidence, 0.80)

        return {
            'detected': detected,
            'confidence': confidence,
            'reasons': reasons
        }

    def detect_scam_behavior(
        self,
        transactions: List[Dict[str, Any]],
        target_address: str,
        wallet_age_days: int
    ) -> Dict[str, Any]:
        """
        Detect scam and honeypot patterns.

        Patterns detected:
        1. New wallet + large funds: Disposable wallet pattern
        2. Blacklist match: Known scam address

        Args:
            transactions: Transaction list
            target_address: Wallet being analyzed
            wallet_age_days: Age of wallet in days

        Returns:
            Detection result with reasons
        """
        detected = False
        reasons = []
        confidence = 0.0

        # Pattern 1: Honeypot detection (new wallet + large funds)
        honeypot_detected = self._detect_honeypot(
            transactions,
            target_address,
            wallet_age_days
        )
        if honeypot_detected:
            detected = True
            reasons.append("Honeypot: New wallet with large incoming funds")
            confidence = max(confidence, 0.70)

        # Pattern 2: Blacklist check
        blacklist_detected = self._check_blacklist(target_address)
        if blacklist_detected:
            detected = True
            reasons.append("Blacklist Match: Address flagged in database")
            confidence = 1.0  # Absolute certainty

        return {
            'detected': detected,
            'confidence': confidence,
            'reasons': reasons
        }

    def aggregate_risk(
        self,
        laundering_result: Dict[str, Any],
        wt_result: Dict[str, Any],
        scam_result: Dict[str, Any],
        ml_prediction: Dict[str, Any] = None,
        transactions: List[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Aggregate results from all detection agents and ML model.

        Hybrid scoring strategy:
        - If ML available: 60% ML score + 40% heuristic score
        - If ML unavailable: 100% heuristic score
        - Blacklist always overrides to 99

        Args:
            laundering_result: Money laundering detection result
            wt_result: Wash trading detection result
            scam_result: Scam detection result
            ml_prediction: ML model prediction (optional)
            transactions: Original transactions for context

        Returns:
            Final risk assessment with blended score
        """
        heuristic_score = 0
        detection_count = 0
        ml_prediction = ml_prediction or {}

        # Check for blacklist (highest priority - overrides everything)
        if scam_result['detected'] and any('Blacklist' in r for r in scam_result['reasons']):
            return {
                'total_score': 99.0,
                'risk_level': 'CRITICAL',
                'breakdown': {
                    'money_laundering': laundering_result,
                    'wash_trading': wt_result,
                    'scam': scam_result,
                    'ml_prediction': ml_prediction
                },
                'detection_count': 1,
                'model': 'Blacklist-Override',
                'ml_contribution': 0.0,
                'heuristic_contribution': 99.0
            }

        # Calculate heuristic score
        if laundering_result['detected']:
            heuristic_score = max(heuristic_score, 90)
            detection_count += 1

        if wt_result['detected']:
            heuristic_score = max(heuristic_score, 70)
            detection_count += 1

        if scam_result['detected']:
            heuristic_score = max(heuristic_score, 85)
            detection_count += 1

        # Bonus for multiple flags
        if detection_count >= 2:
            heuristic_score = min(99, heuristic_score + 5)

        # Blend ML and heuristic scores
        ml_available = ml_prediction.get('ml_available', False)
        ml_score = ml_prediction.get('ml_score', 0.0)
        ml_confidence = ml_prediction.get('ml_confidence', 0.0)

        if ml_available and ml_confidence > 0.3:
            # Weighted blend: 60% ML + 40% heuristic
            # Adjust weights based on ML confidence
            ml_weight = 0.6 * ml_confidence
            heuristic_weight = 1.0 - ml_weight
            total_score = (ml_score * ml_weight) + (heuristic_score * heuristic_weight)
            model_name = 'Hybrid-ML-v2.0'
        else:
            # Fallback to pure heuristic
            total_score = float(heuristic_score)
            ml_weight = 0.0
            heuristic_weight = 1.0
            model_name = 'Multi-Agent-v1.0'

        # Ensure score is in valid range
        total_score = max(0.0, min(99.0, total_score))

        # Determine risk level
        if total_score >= RISK_THRESHOLD_CRITICAL:
            risk_level = 'CRITICAL'
        elif total_score >= RISK_THRESHOLD_HIGH:
            risk_level = 'HIGH'
        elif total_score >= RISK_THRESHOLD_MEDIUM:
            risk_level = 'MEDIUM'
        else:
            risk_level = 'LOW'

        return {
            'total_score': round(total_score, 2),
            'risk_level': risk_level,
            'breakdown': {
                'money_laundering': laundering_result,
                'wash_trading': wt_result,
                'scam': scam_result,
                'ml_prediction': ml_prediction
            },
            'detection_count': detection_count,
            'model': model_name,
            'ml_contribution': round(ml_score * ml_weight, 2) if ml_available else 0.0,
            'heuristic_contribution': round(heuristic_score * heuristic_weight, 2)
        }

    # ==================== PRIVATE HELPER METHODS ====================

    def _detect_structuring(self, outgoing_txs: List[Dict[str, Any]]) -> bool:
        """Detect structuring (breaking large amounts into smaller ones)."""
        if len(outgoing_txs) < 5:
            return False

        # Group by time windows (1 hour)
        time_windows = defaultdict(list)
        for tx in outgoing_txs:
            timestamp = self._parse_timestamp(tx.get('timestamp'))
            hour_key = timestamp.replace(minute=0, second=0, microsecond=0)
            value = tx.get('value', 0)
            if isinstance(value, (int, float)):
                time_windows[hour_key].append(float(value))

        # Check each window for similar amounts
        for window_txs in time_windows.values():
            if len(window_txs) >= 5:
                # Calculate coefficient of variation
                mean_val = np.mean(window_txs)
                std_val = np.std(window_txs)
                if mean_val > 0:
                    cv = std_val / mean_val
                    # Low variation = structuring
                    if cv < 0.15:  # Values within 15% of each other
                        return True

        return False

    def _detect_mixer_usage(self, outgoing_txs: List[Dict[str, Any]]) -> bool:
        """Check for transactions to known mixer addresses."""
        for tx in outgoing_txs:
            to_addr = tx.get('to_address', '').lower()
            if to_addr in KNOWN_MIXERS:
                return True
        return False

    def _detect_cycles(
        self,
        transactions: List[Dict[str, Any]],
        target_address: str
    ) -> bool:
        """Detect A→B→A cycle patterns."""
        # Build interaction map
        interactions = defaultdict(list)

        for tx in transactions:
            from_addr = tx.get('from_address', '').lower()
            to_addr = tx.get('to_address', '').lower()
            timestamp = self._parse_timestamp(tx.get('timestamp'))

            if from_addr == target_address:
                interactions[to_addr].append(('sent', timestamp))
            elif to_addr == target_address:
                interactions[from_addr].append(('received', timestamp))

        # Look for reciprocal transactions
        for addr, events in interactions.items():
            sent_times = [t for action, t in events if action == 'sent']
            received_times = [t for action, t in events if action == 'received']

            # Check for back-and-forth within short time
            for sent_time in sent_times:
                for recv_time in received_times:
                    time_diff = abs((sent_time - recv_time).total_seconds())
                    if time_diff < 3600:  # Within 1 hour
                        return True

        return False

    def _detect_high_frequency(self, transactions: List[Dict[str, Any]]) -> bool:
        """Detect bot-like high frequency trading."""
        if len(transactions) < 50:
            return False

        # Calculate transactions per hour
        timestamps = [self._parse_timestamp(tx.get('timestamp')) for tx in transactions]
        timestamps.sort()

        if len(timestamps) < 2:
            return False

        time_span_hours = (timestamps[-1] - timestamps[0]).total_seconds() / 3600
        if time_span_hours < 0.1:  # Avoid division by zero
            return True

        tx_per_hour = len(transactions) / time_span_hours

        return tx_per_hour > 50

    def _detect_honeypot(
        self,
        transactions: List[Dict[str, Any]],
        target_address: str,
        wallet_age_days: int
    ) -> bool:
        """Detect disposable wallet honeypot pattern."""
        # New wallet check
        if wallet_age_days > 3:
            return False

        # Calculate total received
        total_received = 0
        for tx in transactions:
            if tx.get('to_address', '').lower() == target_address:
                value = tx.get('value', 0)
                if isinstance(value, (int, float)):
                    total_received += float(value)

        # Convert Wei to ETH (if needed)
        eth_received = total_received / 10**18 if total_received > 1000 else total_received

        # Large amount threshold
        return eth_received > 10.0

    def _check_blacklist(self, target_address: str) -> bool:
        """Check if address is in database blacklist."""
        if not self.db_session:
            return False

        try:
            from app.models.models import Blacklist
            result = self.db_session.query(Blacklist).filter(
                Blacklist.address == target_address
            ).first()
            return result is not None
        except Exception as e:
            logger.warning(f"Blacklist check failed: {e}")
            return False

    def _calculate_wallet_age(self, transactions: List[Dict[str, Any]]) -> int:
        """Calculate wallet age from first transaction."""
        if not transactions:
            return 365  # Default to 1 year

        timestamps = [self._parse_timestamp(tx.get('timestamp')) for tx in transactions]
        first_tx = min(timestamps)
        age_days = (datetime.utcnow() - first_tx).days

        return max(1, age_days)

    def _parse_timestamp(self, timestamp: Any) -> datetime:
        """Parse timestamp from various formats."""
        if isinstance(timestamp, datetime):
            return timestamp
        elif isinstance(timestamp, str):
            try:
                return datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            except:
                return datetime.utcnow()
        elif isinstance(timestamp, (int, float)):
            return datetime.fromtimestamp(timestamp)
        return datetime.utcnow()
