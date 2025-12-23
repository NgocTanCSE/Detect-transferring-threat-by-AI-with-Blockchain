"""Extract behavioral features from blockchain transaction history for ML models."""

import logging
from datetime import datetime
from typing import List, Dict, Any

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

WEI_TO_ETH_CONVERSION = 10**18


def extract_transaction_features(wallet_address: str, transactions: List[Dict[str, Any]]) -> pd.DataFrame:
    """
    Transform raw transaction data into feature vector for risk model.

    Compatible with both Etherscan and Alchemy data formats.

    Args:
        wallet_address: Target wallet address to analyze
        transactions: List of transaction dictionaries

    Returns:
        DataFrame with single row containing extracted features
    """
    features = _initialize_feature_dict()

    if not transactions:
        return pd.DataFrame([features])

    normalized_address = wallet_address.lower()

    # Separate ETH and ERC20 transactions
    eth_transactions = [tx for tx in transactions if tx.get('category', 'external') in ['external', None]]
    erc20_transactions = [tx for tx in transactions if tx.get('category') in ['erc20', 'erc721', 'erc1155']]

    # Process ETH transactions
    sent_eth, received_eth = _categorize_transactions(eth_transactions, normalized_address)

    # Process ERC20 transactions
    sent_erc20, received_erc20 = _categorize_transactions(erc20_transactions, normalized_address)

    # Calculate ETH features
    features.update(_calculate_count_features(eth_transactions, sent_eth, received_eth))
    features.update(_calculate_time_features(eth_transactions, sent_eth, received_eth))
    features.update(_calculate_value_features(sent_eth, received_eth))
    features.update(_calculate_unique_address_features(eth_transactions, normalized_address))
    features['total ether balance'] = features['total ether received'] - features['total Ether sent']

    # Calculate ERC20 features
    if erc20_transactions:
        features.update(_calculate_erc20_features(erc20_transactions, sent_erc20, received_erc20, normalized_address))

    return pd.DataFrame([features])


def _initialize_feature_dict() -> Dict[str, float]:
    """Initialize feature dictionary with zero values."""
    return {
        'Avg min between sent tnx': 0.0,
        'Avg min between received tnx': 0.0,
        'Time Diff between first and last (Mins)': 0.0,
        'Sent tnx': 0,
        'Received Tnx': 0,
        'Number of Created Contracts': 0,
        'Unique Received From Addresses': 0,
        'Unique Sent To Addresses': 0,
        'min value received': 0.0,
        'max value received ': 0.0,
        'avg val received': 0.0,
        'min val sent': 0.0,
        'max val sent': 0.0,
        'avg val sent': 0.0,
        'total transactions (including tnx to create contract': 0,
        'total Ether sent': 0.0,
        'total ether received': 0.0,
        'total ether balance': 0.0,
        ' Total ERC20 tnxs': 0.0,
        ' ERC20 total Ether received': 0.0,
        ' ERC20 total ether sent': 0.0,
        ' ERC20 total Ether sent contract': 0.0,
        ' ERC20 uniq sent addr': 0.0,
        ' ERC20 uniq rec addr': 0.0,
        ' ERC20 uniq sent addr.1': 0.0,
        ' ERC20 uniq rec contract addr': 0.0,
        ' ERC20 avg time between sent tnx': 0.0,
        ' ERC20 avg time between rec tnx': 0.0,
        ' ERC20 avg time between rec 2 tnx': 0.0,
        ' ERC20 avg time between contract tnx': 0.0,
        ' ERC20 min val rec': 0.0,
        ' ERC20 max val rec': 0.0,
        ' ERC20 avg val rec': 0.0,
        ' ERC20 min val sent': 0.0,
        ' ERC20 max val sent': 0.0,
        ' ERC20 avg val sent': 0.0,
        ' ERC20 min val sent contract': 0.0,
        ' ERC20 max val sent contract': 0.0,
        ' ERC20 avg val sent contract': 0.0,
    }


def _normalize_value(value: Any) -> float:
    """
    Normalize transaction value from various formats to float.

    Handles: int, float, hex strings, and already normalized values.
    """
    if isinstance(value, (int, float)):
        return float(value)
    elif isinstance(value, str) and value.startswith('0x'):
        return float(int(value, 16))
    return 0.0


def _categorize_transactions(
    transactions: List[Dict[str, Any]],
    target_address: str
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Separate transactions into sent and received based on target address."""
    sent = []
    received = []

    for tx in transactions:
        from_addr = tx.get('from_address', '').lower()
        to_addr = tx.get('to_address', '').lower()

        # Normalize value to ETH (handle both Wei and already converted values)
        value_raw = _normalize_value(tx.get('value', 0))

        # If value is very large (>1000 ETH seems unlikely in normal form), assume it's Wei
        if value_raw > 1000:
            eth_value = value_raw / WEI_TO_ETH_CONVERSION
        else:
            eth_value = value_raw

        tx_with_eth = {
            **tx,
            'eth_value': eth_value
        }

        if from_addr == target_address:
            sent.append(tx_with_eth)
        elif to_addr == target_address:
            received.append(tx_with_eth)

    return sent, received


def _calculate_count_features(
    all_transactions: List[Dict[str, Any]],
    sent: List[Dict[str, Any]],
    received: List[Dict[str, Any]]
) -> Dict[str, int]:
    """Calculate transaction count features."""
    contract_creations = sum(1 for tx in sent if not tx.get('to_address'))

    return {
        'Sent tnx': len(sent),
        'Received Tnx': len(received),
        'total transactions (including tnx to create contract': len(all_transactions),
        'Number of Created Contracts': contract_creations
    }


def _calculate_time_features(
    all_transactions: List[Dict[str, Any]],
    sent: List[Dict[str, Any]],
    received: List[Dict[str, Any]]
) -> Dict[str, float]:
    """Calculate time-based transaction features."""
    features = {}

    if all_transactions:
        timestamps = [_parse_timestamp(tx['timestamp']) for tx in all_transactions]
        sorted_timestamps = sorted(timestamps)
        time_diff_minutes = (sorted_timestamps[-1] - sorted_timestamps[0]).total_seconds() / 60.0
        features['Time Diff between first and last (Mins)'] = time_diff_minutes

    features['Avg min between sent tnx'] = _calculate_average_time_gap(sent)
    features['Avg min between received tnx'] = _calculate_average_time_gap(received)

    return features


def _parse_timestamp(timestamp: Any) -> datetime:
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


def _calculate_average_time_gap(transactions: List[Dict[str, Any]]) -> float:
    """Calculate average time gap between consecutive transactions in minutes."""
    if len(transactions) < 2:
        return 0.0

    timestamps = [_parse_timestamp(tx['timestamp']) for tx in transactions]
    sorted_times = sorted(timestamps)

    time_gaps_minutes = [
        (sorted_times[i] - sorted_times[i-1]).total_seconds() / 60.0
        for i in range(1, len(sorted_times))
    ]

    return float(np.mean(time_gaps_minutes))


def _calculate_value_features(
    sent: List[Dict[str, Any]],
    received: List[Dict[str, Any]]
) -> Dict[str, float]:
    """Calculate value-based transaction features."""
    features = {}

    if sent:
        sent_values = [tx['eth_value'] for tx in sent]
        features.update({
            'min val sent': min(sent_values),
            'max val sent': max(sent_values),
            'avg val sent': float(np.mean(sent_values)),
            'total Ether sent': sum(sent_values)
        })

    if received:
        received_values = [tx['eth_value'] for tx in received]
        features.update({
            'min value received': min(received_values),
            'max value received ': max(received_values),
            'avg val received': float(np.mean(received_values)),
            'total ether received': sum(received_values)
        })

    return features


def _calculate_unique_address_features(
    transactions: List[Dict[str, Any]],
    target_address: str
) -> Dict[str, int]:
    """Calculate features related to unique interaction addresses."""
    sent_to_addresses = set()
    received_from_addresses = set()

    for tx in transactions:
        from_addr = tx.get('from_address', '').lower()
        to_addr = tx.get('to_address', '').lower()

        if from_addr == target_address and to_addr:
            sent_to_addresses.add(to_addr)
        elif to_addr == target_address:
            received_from_addresses.add(from_addr)

    return {
        'Unique Sent To Addresses': len(sent_to_addresses),
        'Unique Received From Addresses': len(received_from_addresses)
    }


def _calculate_erc20_features(
    erc20_transactions: List[Dict[str, Any]],
    sent_erc20: List[Dict[str, Any]],
    received_erc20: List[Dict[str, Any]],
    target_address: str
) -> Dict[str, float]:
    """Calculate ERC20-specific features."""
    features = {
        ' Total ERC20 tnxs': float(len(erc20_transactions)),
    }

    if sent_erc20:
        sent_values = [tx['eth_value'] for tx in sent_erc20]
        features.update({
            ' ERC20 total ether sent': sum(sent_values),
            ' ERC20 min val sent': min(sent_values),
            ' ERC20 max val sent': max(sent_values),
            ' ERC20 avg val sent': float(np.mean(sent_values)),
            ' ERC20 uniq sent addr': float(len(set(tx.get('to_address', '') for tx in sent_erc20 if tx.get('to_address')))),
        })

        features[' ERC20 avg time between sent tnx'] = _calculate_average_time_gap(sent_erc20)

    if received_erc20:
        received_values = [tx['eth_value'] for tx in received_erc20]
        features.update({
            ' ERC20 total Ether received': sum(received_values),
            ' ERC20 min val rec': min(received_values),
            ' ERC20 max val rec': max(received_values),
            ' ERC20 avg val rec': float(np.mean(received_values)),
            ' ERC20 uniq rec addr': float(len(set(tx.get('from_address', '') for tx in received_erc20 if tx.get('from_address')))),
        })

        features[' ERC20 avg time between rec tnx'] = _calculate_average_time_gap(received_erc20)

    return features
