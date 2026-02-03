"""
Rate limiter for transfer endpoints.

Simple in-memory rate limiter with sliding window.
Redis-ready interface for production scaling.
"""

import time
from collections import defaultdict
from threading import Lock
from typing import Dict, Tuple, Optional

# Configuration
MAX_TRANSFERS_PER_MINUTE = 10
MIN_TRANSFER_INTERVAL_SECONDS = 10
CLEANUP_INTERVAL = 300  # 5 minutes


class RateLimiter:
    """Thread-safe sliding window rate limiter."""

    def __init__(
        self,
        max_requests: int = MAX_TRANSFERS_PER_MINUTE,
        window_seconds: int = 60,
        min_interval_seconds: int = MIN_TRANSFER_INTERVAL_SECONDS
    ):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.min_interval_seconds = min_interval_seconds

        # Track timestamps of requests per identifier
        self._requests: Dict[str, list] = defaultdict(list)
        # Track last request time per identifier
        self._last_request: Dict[str, float] = {}

        self._lock = Lock()
        self._last_cleanup = time.time()

    def _cleanup(self) -> None:
        """Remove expired entries to prevent memory leak."""
        now = time.time()
        if now - self._last_cleanup < CLEANUP_INTERVAL:
            return

        cutoff = now - self.window_seconds - 60  # Extra buffer

        # Clean up old request timestamps
        for key in list(self._requests.keys()):
            self._requests[key] = [t for t in self._requests[key] if t > cutoff]
            if not self._requests[key]:
                del self._requests[key]

        # Clean up old last request times
        for key in list(self._last_request.keys()):
            if self._last_request[key] < cutoff:
                del self._last_request[key]

        self._last_cleanup = now

    def check_rate_limit(self, identifier: str) -> Tuple[bool, Optional[str], Optional[int]]:
        """
        Check if request is allowed under rate limit.

        Args:
            identifier: User/wallet identifier

        Returns:
            Tuple of (allowed, error_message, retry_after_seconds)
        """
        with self._lock:
            self._cleanup()
            now = time.time()

            # Check minimum interval between requests
            last_time = self._last_request.get(identifier)
            if last_time:
                elapsed = now - last_time
                if elapsed < self.min_interval_seconds:
                    wait_time = int(self.min_interval_seconds - elapsed) + 1
                    return (
                        False,
                        f"Please wait {wait_time}s between transfers",
                        wait_time
                    )

            # Get requests in current window
            window_start = now - self.window_seconds
            recent_requests = [t for t in self._requests[identifier] if t > window_start]

            # Check if over limit
            if len(recent_requests) >= self.max_requests:
                oldest_in_window = min(recent_requests) if recent_requests else now
                wait_time = int(oldest_in_window + self.window_seconds - now) + 1
                return (
                    False,
                    f"Rate limit exceeded: max {self.max_requests} transfers per minute",
                    wait_time
                )

            return (True, None, None)

    def record_request(self, identifier: str) -> None:
        """Record a successful request for rate limiting."""
        with self._lock:
            now = time.time()
            self._requests[identifier].append(now)
            self._last_request[identifier] = now

    def get_remaining(self, identifier: str) -> int:
        """Get remaining requests in current window."""
        with self._lock:
            now = time.time()
            window_start = now - self.window_seconds
            recent = [t for t in self._requests[identifier] if t > window_start]
            return max(0, self.max_requests - len(recent))

    def get_reset_time(self, identifier: str) -> Optional[int]:
        """Get seconds until rate limit resets."""
        with self._lock:
            now = time.time()
            window_start = now - self.window_seconds
            recent = [t for t in self._requests[identifier] if t > window_start]
            if recent:
                oldest = min(recent)
                return int(oldest + self.window_seconds - now) + 1
            return None


# Global rate limiter instance
transfer_rate_limiter = RateLimiter()


def check_transfer_rate_limit(wallet_address: str) -> Tuple[bool, Optional[str], Optional[int]]:
    """
    Check if a wallet is within transfer rate limits.

    Args:
        wallet_address: Ethereum wallet address

    Returns:
        Tuple of (allowed, error_message, retry_after_seconds)
    """
    return transfer_rate_limiter.check_rate_limit(wallet_address.lower())


def record_transfer(wallet_address: str) -> None:
    """Record a successful transfer for rate limiting."""
    transfer_rate_limiter.record_request(wallet_address.lower())
