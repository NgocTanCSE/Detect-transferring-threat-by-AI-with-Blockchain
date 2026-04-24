import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class DeepScanService:
    """
    Advanced security scanning service for blockchain transaction patterns.
    Implements complex detection logic like Cycle Detection and Trace-back.
    """

    @staticmethod
    def detect_cycles(transactions: List[Dict[str, Any]], target_address: str, time_window_seconds: int = 3600) -> List[Dict[str, Any]]:
        """
        Detect cyclic transaction patterns (A -> B -> A) within a time window.
        Formula: Cycle = ∃(A →_(t_1) B →_(t_2) A) where |t_2-t_1| < time_window
        """
        cycles = []
        target_address = target_address.lower()

        # Group transactions by counterparty
        outgoing = [tx for tx in transactions if tx.get('from_address', '').lower() == target_address]
        incoming = [tx for tx in transactions if tx.get('to_address', '').lower() == target_address]

        for out_tx in outgoing:
            dest = out_tx.get('to_address', '').lower()
            t1 = out_tx.get('timestamp')
            
            if not t1: continue
            if isinstance(t1, str):
                t1 = datetime.fromisoformat(t1.replace('Z', '+00:00'))

            # Look for a returning transaction from the same destination
            for in_tx in incoming:
                src = in_tx.get('from_address', '').lower()
                if src == dest:
                    t2 = in_tx.get('timestamp')
                    if not t2: continue
                    if isinstance(t2, str):
                        t2 = datetime.fromisoformat(t2.replace('Z', '+00:00'))

                    time_diff = abs((t2 - t1).total_seconds())
                    if time_diff < time_window_seconds:
                        cycles.append({
                            "type": "CYCLE",
                            "counterparty": dest,
                            "out_tx": out_tx.get('tx_hash'),
                            "in_tx": in_tx.get('tx_hash'),
                            "time_diff_seconds": time_diff,
                            "value": out_tx.get('value')
                        })
        
        return cycles

    @staticmethod
    def trace_back_funds(transactions: List[Dict[str, Any]], target_address: str, depth: int = 3) -> Dict[str, Any]:
        """
        Perform a simplified trace-back of funds to identify ultimate sources.
        """
        # This is a mock/simplified version since we don't have a full graph crawler here
        sources = {}
        target_address = target_address.lower()

        for tx in transactions:
            if tx.get('to_address', '').lower() == target_address:
                src = tx.get('from_address', '').lower()
                sources[src] = sources.get(src, 0) + float(tx.get('value', 0) or 0)

        return {
            "address": target_address,
            "primary_sources": sorted(sources.items(), key=lambda x: x[1], reverse=True)[:depth],
            "total_traced_value": sum(sources.values())
        }

    def perform_deep_scan(self, transactions: List[Dict[str, Any]], target_address: str) -> Dict[str, Any]:
        """
        Execute all deep scan modules and aggregate results.
        """
        logger.info(f"Starting deep scan for {target_address} across {len(transactions)} transactions")
        
        cycles = self.detect_cycles(transactions, target_address)
        trace_back = self.trace_back_funds(transactions, target_address)
        
        return {
            "wallet": target_address,
            "scan_timestamp": datetime.utcnow().isoformat(),
            "cycle_detected": len(cycles) > 0,
            "cycles": cycles,
            "trace_back": trace_back,
            "risk_indicators": {
                "high_frequency_cycles": len(cycles) > 5,
                "centralized_funding": len(trace_back["primary_sources"]) == 1 and trace_back["total_traced_value"] > 0
            }
        }
