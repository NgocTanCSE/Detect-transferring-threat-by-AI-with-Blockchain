"""FastAPI application for blockchain wallet risk assessment."""

import logging
import os
from datetime import datetime
from typing import Dict, List, Any

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, case

from app.core.database import engine, get_db, Base, ensure_schema
from app.models.models import Wallet, Transaction, TokenTransfer, RiskAssessment, Blacklist, Alert, User, BlockedTransfer, UserWarning, AuditLog
from blockchain_client import fetch_wallet_history
from app.services.ai_engine import MultiAgentDetectionEngine


def _get_or_create_wallet(database_session: Session, address: str) -> Wallet:
    wallet = database_session.query(Wallet).filter(Wallet.address == address).first()
    if not wallet:
        wallet = Wallet(address=address)
        database_session.add(wallet)
        database_session.commit()
        database_session.refresh(wallet)

    # Optional: seed a demo balance as real DB data (one-time) for easier end-to-end testing.
    # Default is OFF unless explicitly configured via env.
    demo_address = os.getenv("DEMO_FUNDED_ADDRESS", "").lower().strip()
    demo_amount_eth = float(os.getenv("DEMO_INITIAL_BALANCE_ETH", "0"))

    if demo_address and address == demo_address and demo_amount_eth > 0:
        has_any_tx = (
            database_session.query(Transaction)
            .filter((Transaction.from_address == address) | (Transaction.to_address == address))
            .first()
        )
        if not has_any_tx:
            import uuid
            credit_tx = Transaction(
                tx_hash=f"sim_genesis_{uuid.uuid4().hex}",
                from_address="system",
                to_address=address,
                value=_wei_from_eth(demo_amount_eth),
                block_number=0,
                timestamp=datetime.utcnow(),
                gas_price=0,
                gas_used=0,
                input_data="0x",
                status=1
            )
            database_session.add(credit_tx)
            database_session.commit()

    return wallet


def _wei_from_eth(amount_eth: float) -> int:
    return int(round(amount_eth * 10**18))


def _eth_from_wei(amount_wei: int) -> float:
    return float(amount_wei) / 10**18

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)
ensure_schema()

app = FastAPI(
    title="Blockchain Risk Assessment API",
    version="3.0.0",
    description="AI-powered financial risk analysis for Ethereum wallets with Alchemy integration"
)

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Health"])
def health_check() -> Dict[str, str]:
    """API health check endpoint."""
    return {"status": "operational", "service": "Blockchain Risk Assessment API v3.0"}


@app.get("/analyze/{wallet_address}", tags=["Risk Assessment"])
def analyze_wallet_risk(
    wallet_address: str,
    database_session: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Perform comprehensive risk assessment on an Ethereum wallet address.

    Fetches real-time transaction data from Alchemy, persists to database,
    and runs AI-powered multi-agent risk assessment.

    Args:
        wallet_address: Ethereum wallet address to analyze
        database_session: Database session dependency

    Returns:
        Risk assessment results including score, level, and transaction data
    """
    normalized_address = wallet_address.lower().strip()

    def _risk_level_from_score(score: float) -> str:
        if score >= 90:
            return "CRITICAL"
        if score >= 80:
            return "HIGH"
        if score >= 50:
            return "MEDIUM"
        return "LOW"

    # Step 0: Check blacklist first (instant response for known threats)
    blacklist_record = database_session.query(Blacklist).filter(
        Blacklist.address == normalized_address
    ).first()

    if blacklist_record:
        logger.warning(f"Blacklisted wallet detected: {normalized_address}")
        return {
            "address": normalized_address,
            "risk_score": 100.0,
            "risk_level": "CRITICAL",
            "details": {
                "money_laundering": {"detected": False, "confidence": 0.0, "reasons": []},
                "wash_trading": {"detected": False, "confidence": 0.0, "reasons": []},
                "scam": {"detected": True, "confidence": 1.0, "reasons": ["Blacklist Match: Address flagged in database"]}
            },
            "detection_count": 1,
            "model": "Blacklist-Check",
            "cached": True,
            "blacklisted": True,
            "transaction_count": 0,
            "recent_transactions": []
        }

    try:
        # Step 1: Fetch fresh blockchain data from Alchemy
        logger.info(f"Fetching transaction history for {normalized_address}")
        transaction_history = fetch_wallet_history(normalized_address, max_count=100)

        if not transaction_history:
            logger.warning(f"No transaction history found for {normalized_address}")

            # Fall back to cached DB info (wallet record + latest alert)
            wallet_record = database_session.query(Wallet).filter(
                Wallet.address == normalized_address
            ).first()
            latest_alert = (
                database_session.query(Alert)
                .filter(Alert.wallet_address == normalized_address)
                .order_by(Alert.detected_at.desc())
                .first()
            )

            cached_score = 0.0
            if wallet_record and wallet_record.risk_score is not None:
                cached_score = max(cached_score, float(wallet_record.risk_score or 0.0))
            if latest_alert and latest_alert.risk_score is not None:
                cached_score = max(cached_score, float(latest_alert.risk_score or 0.0))

            tx_count = 0
            try:
                tx_count = int(
                    database_session.query(func.count(Transaction.id))
                    .filter(
                        (Transaction.from_address == normalized_address)
                        | (Transaction.to_address == normalized_address)
                    )
                    .scalar()
                    or 0
                )
            except Exception:
                tx_count = int(wallet_record.total_transactions or 0) if wallet_record else 0

            return {
                "address": normalized_address,
                "risk_score": cached_score,
                "risk_level": _risk_level_from_score(cached_score),
                "details": {
                    "money_laundering": {"detected": False, "confidence": 0.0, "reasons": []},
                    "wash_trading": {"detected": False, "confidence": 0.0, "reasons": []},
                    "scam": {"detected": False, "confidence": 0.0, "reasons": []}
                },
                "detection_count": 0,
                "model": "Cached-DB",
                "cached": True,
                "blacklisted": False,
                "first_seen_at": wallet_record.first_seen_at.isoformat() if wallet_record and wallet_record.first_seen_at else None,
                "last_activity_at": wallet_record.last_activity_at.isoformat() if wallet_record and wallet_record.last_activity_at else None,
                "transaction_count": tx_count,
                "recent_transactions": []
            }

        logger.info(f"Retrieved {len(transaction_history)} transactions")

        # Step 2: Persist to database for caching and analysis
        _persist_blockchain_data(database_session, transaction_history, normalized_address)

        # Step 3: Run AI-powered multi-agent risk assessment
        ai_engine = MultiAgentDetectionEngine(database_session=database_session)
        risk_analysis = ai_engine.analyze_wallet(
            wallet_address=normalized_address,
            transactions=transaction_history
        )

        # Step 4: Update or create wallet record
        wallet_record = database_session.query(Wallet).filter(
            Wallet.address == normalized_address
        ).first()

        if not wallet_record:
            wallet_record = Wallet(
                address=normalized_address,
                risk_score=risk_analysis["total_score"],
                total_transactions=len(transaction_history),
                first_seen_at=transaction_history[-1]["timestamp"] if transaction_history else None,
                last_activity_at=transaction_history[0]["timestamp"] if transaction_history else None
            )
            database_session.add(wallet_record)
            database_session.commit()
            database_session.refresh(wallet_record)
        else:
            wallet_record.risk_score = risk_analysis["total_score"]
            wallet_record.total_transactions = len(transaction_history)
            if not wallet_record.first_seen_at and transaction_history:
                wallet_record.first_seen_at = transaction_history[-1]["timestamp"]
            wallet_record.last_activity_at = transaction_history[0]["timestamp"] if transaction_history else None
            wallet_record.updated_at = datetime.utcnow()
            database_session.commit()

        # Step 5: Save risk assessment record
        assessment_record = RiskAssessment(
            wallet_id=wallet_record.id,
            score=risk_analysis["total_score"],
            risk_level=risk_analysis["risk_level"],
            details=risk_analysis["breakdown"],
            model_version=risk_analysis.get("model", "Multi-Agent-v1.0")
        )
        database_session.add(assessment_record)
        database_session.commit()

        # Step 6: Return comprehensive results with breakdown
        return {
            "address": normalized_address,
            "risk_score": risk_analysis["total_score"],
            "risk_level": risk_analysis["risk_level"],
            "details": risk_analysis["breakdown"],
            "detection_count": risk_analysis["detection_count"],
            "model": risk_analysis["model"],
            "cached": False,
            "first_seen_at": wallet_record.first_seen_at.isoformat() if wallet_record.first_seen_at else None,
            "last_activity_at": wallet_record.last_activity_at.isoformat() if wallet_record.last_activity_at else None,
            "transaction_count": len(transaction_history),
            "recent_transactions": transaction_history[:10]
        }

    except Exception as analysis_error:
        logger.error(f"Analysis failed for {normalized_address}: {analysis_error}")
        raise HTTPException(
            status_code=500,
            detail=f"Risk analysis failed: {str(analysis_error)}"
        )


def _persist_blockchain_data(
    database_session: Session,
    transactions: List[Dict[str, Any]],
    wallet_address: str
) -> None:
    """
    Persist transaction data to database with deduplication.

    Saves both ETH transactions and ERC20 token transfers to appropriate tables.

    Args:
        database_session: Database session
        transactions: List of transaction dictionaries from Alchemy
        wallet_address: Target wallet address
    """
    eth_count = 0
    token_count = 0

    for tx_data in transactions:
        try:
            tx_hash = tx_data.get("tx_hash", "")
            category = tx_data.get("category", "external")

            # Check if transaction already exists
            existing_tx = database_session.query(Transaction).filter(
                Transaction.tx_hash == tx_hash
            ).first()

            if not existing_tx:
                # Insert new transaction record
                transaction_record = Transaction(
                    tx_hash=tx_hash,
                    from_address=tx_data.get("from_address", ""),
                    to_address=tx_data.get("to_address"),
                    value=int(tx_data.get("value", 0)),
                    block_number=tx_data.get("block_number", 0),
                    timestamp=tx_data.get("timestamp"),
                    gas_price=int(tx_data.get("gas_price", 0)),
                    gas_used=int(tx_data.get("gas_used", 0)),
                    input_data=tx_data.get("input_data", "0x"),
                    status=1  # Assume success (Alchemy only returns successful transfers)
                )
                database_session.add(transaction_record)
                eth_count += 1

            # Handle ERC20/ERC721/ERC1155 token transfers
            if category in ['erc20', 'erc721', 'erc1155']:
                from app.models.models import TokenTransfer

                # Check for existing token transfer
                existing_token = database_session.query(TokenTransfer).filter(
                    TokenTransfer.transaction_hash == tx_hash,
                    TokenTransfer.from_address == tx_data.get("from_address", ""),
                    TokenTransfer.to_address == tx_data.get("to_address", "")
                ).first()

                if not existing_token:
                    token_transfer = TokenTransfer(
                        transaction_hash=tx_hash,
                        block_number=tx_data.get("block_number", 0),
                        log_index=0,  # Alchemy doesn't provide this
                        token_address=tx_data.get("asset", ""),
                        token_symbol=tx_data.get("asset", "")[:10] if tx_data.get("asset") else None,
                        from_address=tx_data.get("from_address", ""),
                        to_address=tx_data.get("to_address", ""),
                        value=int(tx_data.get("value", 0)),
                        value_decimal=float(tx_data.get("value", 0)) / 10**18,
                        transfer_type=category.upper(),
                        timestamp=tx_data.get("timestamp")
                    )
                    database_session.add(token_transfer)
                    token_count += 1

        except Exception as persist_error:
            logger.warning(f"Failed to persist transaction {tx_data.get('tx_hash')}: {persist_error}")
            continue

    try:
        database_session.commit()
        logger.info(f"Persisted {eth_count} transactions and {token_count} token transfers")
    except IntegrityError as integrity_error:
        database_session.rollback()
        logger.debug(f"Duplicate records ignored: {integrity_error}")


@app.get("/alerts/recent", tags=["Alerts"])
def get_recent_alerts(
    limit: int = 50,
    database_session: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Retrieve recent security alerts from scanner service.

    Args:
        limit: Maximum number of alerts to return
        database_session: Database session dependency

    Returns:
        Dictionary containing alerts list and statistics
    """
    from datetime import timedelta

    recent_alerts = database_session.query(Alert).order_by(
        Alert.detected_at.desc()
    ).limit(limit).all()

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    alerts_today = database_session.query(Alert).filter(
        Alert.detected_at >= today_start
    ).count()

    critical_alerts = database_session.query(Alert).filter(
        Alert.severity == "CRITICAL"
    ).count()

    return {
        "alerts": [
            {
                "id": str(alert.id),
                "wallet_address": alert.wallet_address,
                "alert_type": alert.alert_type,
                "severity": alert.severity,
                "message": alert.message,
                "risk_score": alert.risk_score,
                "metadata": alert.meta,
                "detected_at": alert.detected_at.isoformat(),
                "acknowledged": bool(alert.acknowledged)
            }
            for alert in recent_alerts
        ],
        "statistics": {
            "total_alerts_today": alerts_today,
            "critical_count": critical_alerts,
            "total_recent": len(recent_alerts)
        }
    }


@app.get("/alerts/latest", tags=["Alerts"])
def get_latest_alerts(
    limit: int = 5,
    database_session: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Retrieve latest security alerts for real-time ticker display.

    Optimized endpoint for polling - returns minimal data frequently.

    Args:
        limit: Maximum number of alerts to return (default: 5)
        database_session: Database session dependency

    Returns:
        Dictionary containing latest alerts list
    """
    latest_alerts = database_session.query(Alert).order_by(
        Alert.detected_at.desc()
    ).limit(limit).all()

    return {
        "alerts": [
            {
                "id": str(alert.id),
                "wallet_address": alert.wallet_address or "",  # Return FULL address

                "alert_type": alert.alert_type,
                "severity": alert.severity,
                "message": alert.message,
                "risk_score": alert.risk_score,
                "metadata": alert.meta,
                "detected_at": alert.detected_at.isoformat()
            }
            for alert in latest_alerts
        ],
        "count": len(latest_alerts),
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/balance/{wallet_address}", tags=["Wallet"])
@app.get("/wallet/{wallet_address}/balance", tags=["Wallet"])
def get_wallet_balance(wallet_address: str, database_session: Session = Depends(get_db)) -> Dict[str, Any]:
    """Return balance computed from transactions table (in - out)."""
    normalized_address = wallet_address.lower().strip()
    wallet = _get_or_create_wallet(database_session, normalized_address)

    received_wei = (
        database_session.query(func.coalesce(func.sum(Transaction.value), 0))
        .filter(Transaction.to_address == normalized_address)
        .scalar()
    )
    sent_wei = (
        database_session.query(func.coalesce(func.sum(Transaction.value), 0))
        .filter(Transaction.from_address == normalized_address)
        .scalar()
    )
    balance_wei = int(received_wei or 0) - int(sent_wei or 0)

    return {
        "address": normalized_address,
        "balance_wei": balance_wei,
        "balance_eth": _eth_from_wei(balance_wei),
        "risk_score": wallet.risk_score,
        "total_transactions": int(wallet.total_transactions or 0)
    }


@app.get("/transactions/{wallet_address}", tags=["Transaction"])
@app.get("/wallet/{wallet_address}/transactions", tags=["Transaction"])
def get_wallet_transactions(
    wallet_address: str,
    limit: int = 20,
    database_session: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Return recent transactions for a wallet from DB (fallback to Alchemy fetch+persist)."""
    normalized_address = wallet_address.lower().strip()

    # Try DB first
    txs = (
        database_session.query(Transaction)
        .filter((Transaction.from_address == normalized_address) | (Transaction.to_address == normalized_address))
        .order_by(Transaction.timestamp.desc().nullslast(), Transaction.created_at.desc())
        .limit(limit)
        .all()
    )

    # If empty, fetch from Alchemy and persist
    if not txs:
        history = fetch_wallet_history(normalized_address, max_count=max(limit, 50))
        if history:
            _persist_blockchain_data(database_session, history, normalized_address)
            txs = (
                database_session.query(Transaction)
                .filter((Transaction.from_address == normalized_address) | (Transaction.to_address == normalized_address))
                .order_by(Transaction.timestamp.desc().nullslast(), Transaction.created_at.desc())
                .limit(limit)
                .all()
            )

    return {
        "address": normalized_address,
        "count": len(txs),
        "transactions": [
            {
                "id": str(tx.id),
                "tx_hash": tx.tx_hash,
                "from_address": tx.from_address,
                "to_address": tx.to_address,
                "value_wei": int(tx.value or 0),
                "value_eth": _eth_from_wei(int(tx.value or 0)),
                "timestamp": tx.timestamp.isoformat() if tx.timestamp else None,
                "status": int(tx.status or 1),
                "is_flagged": bool(tx.is_flagged),
                "flag_reason": tx.flag_reason,
                "gas_price": str(tx.gas_price or 0),
                "gas_used": int(tx.gas_used or 0),
                "block_number": int(tx.block_number or 0)
            }
            for tx in txs
        ]
    }


@app.post("/transfer/protected", tags=["Transaction"])
def protected_transfer(
    payload: Dict[str, Any],
    database_session: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Protected transfer endpoint with wallet ID validation and AI risk assessment.

    Supports 3-strike warning system:
    - Risk 0-50: Auto-approve
    - Risk 50-80: Require user confirmation
    - Risk >80 or blacklisted: Block immediately

    Args:
        from_wallet_id: Source wallet ID
        to_wallet_id: Destination wallet ID
        to_address: Destination Ethereum address
        amount_eth: Amount in ETH
        confirm_risk: User acknowledged the risk (for 50-80 case)
    """
    from_wallet_id = str(payload.get("from_wallet_id", "")).strip()
    to_wallet_id = str(payload.get("to_wallet_id", "")).strip()
    to_address = str(payload.get("to_address", "")).lower().strip()
    amount_eth = float(payload.get("amount_eth", 0))
    confirm_risk = payload.get("confirm_risk", False)

    # Validate inputs
    if not from_wallet_id or not to_wallet_id or amount_eth <= 0:
        raise HTTPException(
            status_code=400,
            detail="from_wallet_id, to_wallet_id, and amount_eth are required"
        )

    # Helper function to find wallet by ID or address
    def find_wallet(identifier: str):
        # Try as UUID first
        try:
            import uuid as uuid_module
            uuid_module.UUID(identifier)
            wallet = database_session.query(Wallet).filter(Wallet.id == identifier).first()
            if wallet:
                return wallet
        except (ValueError, AttributeError):
            pass
        # Try as address (0x...)
        normalized = identifier.lower().strip()
        return database_session.query(Wallet).filter(Wallet.address == normalized).first()

    # Get source wallet by ID or address
    from_wallet = find_wallet(from_wallet_id)
    if not from_wallet:
        raise HTTPException(status_code=404, detail="Source wallet not found")

    sender = from_wallet.address

    # Check if sender is suspended
    if from_wallet.account_status == 'suspended':
        raise HTTPException(
            status_code=403,
            detail="Your account is suspended due to multiple risk warnings. Contact support."
        )

    # Get destination wallet by ID or address
    to_wallet = find_wallet(to_wallet_id)
    if not to_wallet:
        # If wallet not found in DB, use to_address or to_wallet_id as the receiver address
        receiver_address = to_address if to_address else to_wallet_id.lower().strip()
        # Create a new wallet record for this address
        if receiver_address.startswith('0x') and len(receiver_address) == 42:
            to_wallet = Wallet(address=receiver_address, entity_type='Unknown', account_status='active')
            database_session.add(to_wallet)
            database_session.commit()
            database_session.refresh(to_wallet)
        else:
            raise HTTPException(status_code=404, detail="Destination wallet not found and invalid address format")

    receiver = to_wallet.address

    # Get sender's current warning count
    warning_count = database_session.query(UserWarning).filter(
        UserWarning.wallet_address == sender
    ).count()

    # Check receiver risk
    blacklist_record = database_session.query(Blacklist).filter(
        Blacklist.address == receiver
    ).first()

    receiver_risk = float(to_wallet.risk_score or 0)
    receiver_status = to_wallet.account_status

    # If receiver has no risk score or outdated data, run AI analysis
    if receiver_risk == 0 or to_wallet.risk_score is None:
        try:
            # Fetch fresh blockchain data and run AI analysis
            tx_history = fetch_wallet_history(receiver, max_count=100)
            ai_engine = MultiAgentDetectionEngine(database_session=database_session)
            risk_analysis = ai_engine.analyze_wallet(wallet_address=receiver, transactions=tx_history)
            receiver_risk = float(risk_analysis["total_score"])

            # Update wallet with new risk score
            to_wallet.risk_score = receiver_risk
            to_wallet.last_activity_at = datetime.utcnow()

            # Auto-update status based on risk
            if receiver_risk >= 90:
                to_wallet.account_status = 'frozen'
                to_wallet.risk_category = risk_analysis.get("highest_category", "scam")
            elif receiver_risk >= 70:
                to_wallet.account_status = 'suspended'
                to_wallet.risk_category = risk_analysis.get("highest_category", "manipulation")
            elif receiver_risk >= 50:
                to_wallet.account_status = 'under_review'

            database_session.commit()
            receiver_status = to_wallet.account_status
            logger.info(f"Real-time AI analysis for {receiver}: risk={receiver_risk}%")
        except Exception as e:
            logger.warning(f"AI analysis failed for {receiver}: {e}")
            # Continue with cached/default risk

    if blacklist_record:
        receiver_risk = 100.0
        receiver_status = "blacklisted"

    # Critical risk (>80 or blacklisted) - Block immediately
    if receiver_risk >= 80 or blacklist_record or receiver_status in ['frozen', 'suspended']:
        # Record blocked transfer
        blocked = BlockedTransfer(
            sender_address=sender,
            receiver_address=receiver,
            amount=_wei_from_eth(amount_eth),
            risk_score=receiver_risk,
            block_reason="high_risk_receiver",
            user_warning_count=warning_count
        )
        database_session.add(blocked)
        database_session.commit()

        return {
            "status": "blocked",
            "requires_confirmation": False,
            "receiver_risk": receiver_risk,
            "message": f"Transfer blocked: Receiver is high-risk (score: {receiver_risk}%)",
            "block_reason": receiver_status if receiver_status != "unknown" else "high_risk"
        }

    # Medium risk (50-80) - Show warning if not confirmed
    if receiver_risk >= 50 and not confirm_risk:
        return {
            "status": "warning",
            "requires_confirmation": True,
            "receiver_risk": receiver_risk,
            "current_warnings": warning_count,
            "max_warnings": 3,
            "message": f"⚠️ This wallet has a risk score of {receiver_risk}%. Are you sure you want to proceed?",
            "warning_text": f"You have {3 - warning_count} warnings remaining before account suspension."
        }

    # User chose to proceed despite warning
    if confirm_risk and receiver_risk >= 50:
        # Record warning
        new_warning = UserWarning(
            wallet_address=sender,
            target_address=receiver,
            warning_type="RISK_IGNORED",
            risk_score=receiver_risk,
            user_action="ignored",
            warning_number=warning_count + 1
        )
        database_session.add(new_warning)
        warning_count += 1

        # Check if 3 strikes reached
        if warning_count >= 3:
            from_wallet.account_status = 'suspended'
            from_wallet.flagged_at = datetime.utcnow()
            from_wallet.flagged_by = 'SYSTEM_AUTO_SUSPEND'
            from_wallet.notes = f"{from_wallet.notes or ''}\n[{datetime.utcnow().isoformat()}] Auto-suspended after 3 risk warnings."

            # Create alert for admin
            suspend_alert = Alert(
                wallet_address=sender,
                alert_type="USER_SUSPENDED",
                severity="HIGH",
                message=f"User account auto-suspended after ignoring 3 risk warnings. Last attempted transfer to {receiver}.",
                risk_score=receiver_risk,
                meta={
                    "warning_count": warning_count,
                    "last_target": receiver,
                    "last_risk": receiver_risk
                }
            )
            database_session.add(suspend_alert)
            database_session.commit()

            return {
                "status": "blocked",
                "suspended": True,
                "message": "Account suspended after 3 ignored risk warnings",
                "warning_count": warning_count
            }

        database_session.commit()

    # Proceed with transaction (low risk or user accepted warning)
    amount_wei = _wei_from_eth(amount_eth)

    # Check balance
    sender_received_wei = database_session.query(
        func.coalesce(func.sum(Transaction.value), 0)
    ).filter(Transaction.to_address == sender).scalar()

    sender_sent_wei = database_session.query(
        func.coalesce(func.sum(Transaction.value), 0)
    ).filter(Transaction.from_address == sender).scalar()

    sender_balance_wei = int(sender_received_wei or 0) - int(sender_sent_wei or 0)

    if sender_balance_wei < amount_wei:
        return {
            "status": "blocked",
            "message": f"Insufficient balance. Available: {_eth_from_wei(sender_balance_wei)} ETH",
            "available_balance": _eth_from_wei(sender_balance_wei)
        }

    # Create transaction
    import uuid as uuid_module
    tx_hash = f"sim_{uuid_module.uuid4().hex}"
    tx = Transaction(
        tx_hash=tx_hash,
        from_address=sender,
        to_address=receiver,
        value=amount_wei,
        block_number=0,
        timestamp=datetime.utcnow(),
        gas_price=0,
        gas_used=0,
        input_data="0x",
        status=1
    )
    database_session.add(tx)

    # Update wallets
    from_wallet.total_value_sent = int(from_wallet.total_value_sent or 0) + amount_wei
    from_wallet.total_transactions = int(from_wallet.total_transactions or 0) + 1
    from_wallet.last_activity_at = datetime.utcnow()

    to_wallet.total_value_received = int(to_wallet.total_value_received or 0) + amount_wei
    to_wallet.total_transactions = int(to_wallet.total_transactions or 0) + 1
    to_wallet.last_activity_at = datetime.utcnow()

    database_session.commit()

    # Calculate new balance
    new_balance_wei = sender_balance_wei - amount_wei

    return {
        "status": "success",
        "tx_hash": tx_hash,
        "from": sender,
        "to": receiver,
        "amount_eth": amount_eth,
        "receiver_risk_score": receiver_risk,
        "warning_count": warning_count,
        "sender_balance_eth": _eth_from_wei(new_balance_wei),
        "message": "Transaction completed successfully" + (f" (Warning #{warning_count} recorded)" if confirm_risk and receiver_risk >= 50 else "")
    }


@app.post("/send", tags=["Transaction"])
def send_eth(
    payload: Dict[str, Any],
    database_session: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Simulate send ETH with real risk check and DB-ledger updates (no on-chain transfer)."""
    sender = str(payload.get("sender", "")).lower().strip()
    receiver = str(payload.get("receiver", "")).lower().strip()
    amount = float(payload.get("amount", 0))

    if not sender or not receiver:
        raise HTTPException(status_code=400, detail="sender and receiver are required")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    def _record_block_alert(reason: str, risk_score: float | None = None) -> None:
        try:
            alert = Alert(
                wallet_address=receiver,
                alert_type="BLOCKED_TRANSFER",
                severity="HIGH",
                message=f"Blocked transfer attempt from {sender} to {receiver}: {reason}",
                risk_score=risk_score,
                meta={
                    "sender": sender,
                    "receiver": receiver,
                    "amount": amount,
                    "reason": reason,
                },
                detected_at=datetime.utcnow(),
            )
            database_session.add(alert)
            database_session.commit()
        except Exception:
            database_session.rollback()

    # Block immediately if receiver is blacklisted (canonical rule).
    blacklist_record = database_session.query(Blacklist).filter(Blacklist.address == receiver).first()
    if blacklist_record:
        _record_block_alert("blacklisted")
        raise HTTPException(status_code=403, detail="Receiver blocked (blacklisted)")

    # Block if receiver has a recent scanner alert.
    latest_receiver_alert = (
        database_session.query(Alert)
        .filter(Alert.wallet_address == receiver)
        .order_by(Alert.detected_at.desc())
        .first()
    )
    if latest_receiver_alert and float(latest_receiver_alert.risk_score or 0.0) >= 80:
        _record_block_alert(
            "recent alert",
            risk_score=float(latest_receiver_alert.risk_score or 0.0),
        )
        raise HTTPException(
            status_code=403,
            detail=f"Receiver blocked (alert risk={float(latest_receiver_alert.risk_score or 0.0)})"
        )

    # Block immediately if receiver already has a high persisted risk score.
    existing_receiver_wallet = database_session.query(Wallet).filter(Wallet.address == receiver).first()
    if existing_receiver_wallet and float(existing_receiver_wallet.risk_score or 0.0) >= 80:
        _record_block_alert("cached wallet risk", risk_score=float(existing_receiver_wallet.risk_score or 0.0))
        raise HTTPException(
            status_code=403,
            detail=f"Receiver blocked (cached risk={float(existing_receiver_wallet.risk_score or 0.0)})"
        )

    # Run risk analysis for receiver using fresh chain data
    tx_history = fetch_wallet_history(receiver, max_count=100)
    ai_engine = MultiAgentDetectionEngine(database_session=database_session)
    risk_analysis = ai_engine.analyze_wallet(wallet_address=receiver, transactions=tx_history)
    receiver_risk = float(risk_analysis.get("total_score", 0.0))
    receiver_level = str(risk_analysis.get("risk_level", "LOW"))

    # Block policy (server-side, canonical)
    if receiver_level in {"HIGH", "CRITICAL"} or receiver_risk >= 80:
        _record_block_alert(f"live risk level={receiver_level}", risk_score=receiver_risk)
        raise HTTPException(status_code=403, detail=f"Receiver blocked (risk={receiver_risk}, level={receiver_level})")

    sender_wallet = _get_or_create_wallet(database_session, sender)
    receiver_wallet = _get_or_create_wallet(database_session, receiver)

    amount_wei = _wei_from_eth(amount)
    sender_received_wei = (
        database_session.query(func.coalesce(func.sum(Transaction.value), 0))
        .filter(Transaction.to_address == sender)
        .scalar()
    )
    sender_sent_wei = (
        database_session.query(func.coalesce(func.sum(Transaction.value), 0))
        .filter(Transaction.from_address == sender)
        .scalar()
    )
    sender_balance_wei = int(sender_received_wei or 0) - int(sender_sent_wei or 0)
    if sender_balance_wei < amount_wei:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    # Update internal ledger stats
    sender_wallet.total_value_sent = int(sender_wallet.total_value_sent or 0) + amount_wei
    sender_wallet.total_transactions = int(sender_wallet.total_transactions or 0) + 1
    sender_wallet.last_activity_at = datetime.utcnow()

    receiver_wallet.total_value_received = int(receiver_wallet.total_value_received or 0) + amount_wei
    receiver_wallet.total_transactions = int(receiver_wallet.total_transactions or 0) + 1
    receiver_wallet.last_activity_at = datetime.utcnow()
    receiver_wallet.risk_score = receiver_risk

    # Record a simulated tx into transactions table
    import uuid
    tx_hash = f"sim_{uuid.uuid4().hex}"
    tx = Transaction(
        tx_hash=tx_hash,
        from_address=sender,
        to_address=receiver,
        value=amount_wei,
        block_number=0,
        timestamp=datetime.utcnow(),
        gas_price=0,
        gas_used=0,
        input_data="0x",
        status=1
    )
    database_session.add(tx)
    database_session.commit()

    # Recompute post-tx balance from transactions table
    sender_received_wei = (
        database_session.query(func.coalesce(func.sum(Transaction.value), 0))
        .filter(Transaction.to_address == sender)
        .scalar()
    )
    sender_sent_wei = (
        database_session.query(func.coalesce(func.sum(Transaction.value), 0))
        .filter(Transaction.from_address == sender)
        .scalar()
    )
    new_sender_balance_wei = int(sender_received_wei or 0) - int(sender_sent_wei or 0)
    return {
        "status": "success",
        "tx_hash": tx_hash,
        "from": sender,
        "to": receiver,
        "amount_eth": amount,
        "amount_wei": amount_wei,
        "receiver_risk_score": receiver_risk,
        "receiver_risk_level": receiver_level,
        "sender_balance_wei": new_sender_balance_wei,
        "sender_balance_eth": _eth_from_wei(new_sender_balance_wei)
    }


# ==========================================
# ADMIN DASHBOARD ENDPOINTS
# ==========================================

@app.get("/wallets", tags=["Admin - Wallets"])
def get_all_wallets(
    status: str = None,
    account_status: str = None,  # Alias for status (frontend uses this)
    risk_category: str = None,
    min_risk: float = None,
    min_risk_score: float = None,  # Alias for min_risk (frontend uses this)
    limit: int = 100,
    database_session: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get all monitored wallets with optional filtering.

    Args:
        status: Filter by account_status (active, suspended, frozen, under_review)
        account_status: Alias for status parameter
        risk_category: Filter by risk_category (money_laundering, manipulation, scam)
        min_risk: Minimum risk score filter
        min_risk_score: Alias for min_risk parameter
        limit: Maximum results to return
    """
    query = database_session.query(Wallet)

    # Support both parameter names
    actual_status = status or account_status
    actual_min_risk = min_risk if min_risk is not None else min_risk_score

    if actual_status:
        query = query.filter(Wallet.account_status == actual_status)
    if risk_category:
        query = query.filter(Wallet.risk_category == risk_category)
    if actual_min_risk is not None:
        query = query.filter(Wallet.risk_score >= actual_min_risk)

    wallets = query.order_by(Wallet.risk_score.desc()).limit(limit).all()

    # Get statistics
    total_wallets = database_session.query(Wallet).count()
    high_risk_count = database_session.query(Wallet).filter(Wallet.risk_score >= 80).count()
    suspended_count = database_session.query(Wallet).filter(Wallet.account_status == 'suspended').count()
    frozen_count = database_session.query(Wallet).filter(Wallet.account_status == 'frozen').count()

    return {
        "wallets": [
            {
                "id": str(w.id),
                "address": w.address,
                "label": w.label,
                "entity_type": w.entity_type,
                "account_status": w.account_status,
                "risk_score": float(w.risk_score or 0),
                "risk_category": w.risk_category,
                "total_transactions": int(w.total_transactions or 0),
                "first_seen_at": w.first_seen_at.isoformat() if w.first_seen_at else None,
                "last_activity_at": w.last_activity_at.isoformat() if w.last_activity_at else None,
                "flagged_at": w.flagged_at.isoformat() if w.flagged_at else None,
                "notes": w.notes
            }
            for w in wallets
        ],
        "statistics": {
            "total_wallets": total_wallets,
            "high_risk_count": high_risk_count,
            "suspended_count": suspended_count,
            "frozen_count": frozen_count
        },
        "count": len(wallets)
    }


@app.put("/wallets/{wallet_address}/status", tags=["Admin - Wallets"])
def update_wallet_status(
    wallet_address: str,
    payload: Dict[str, Any],
    database_session: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Update wallet account status (active, suspended, frozen, under_review).

    Args:
        wallet_address: Target wallet address
        payload: { "status": "suspended", "reason": "...", "admin_id": "..." }
    """
    normalized_address = wallet_address.lower().strip()
    new_status = payload.get("status", "").lower()
    reason = payload.get("reason", "")
    admin_id = payload.get("admin_id", "system")

    valid_statuses = ["active", "suspended", "frozen", "under_review"]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    wallet = database_session.query(Wallet).filter(Wallet.address == normalized_address).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    old_status = wallet.account_status
    wallet.account_status = new_status
    wallet.flagged_at = datetime.utcnow() if new_status in ["suspended", "frozen"] else wallet.flagged_at
    wallet.flagged_by = admin_id if new_status in ["suspended", "frozen"] else wallet.flagged_by
    wallet.notes = f"{wallet.notes or ''}\n[{datetime.utcnow().isoformat()}] Status changed: {old_status} -> {new_status}. Reason: {reason}"
    wallet.updated_at = datetime.utcnow()

    # Create audit log
    audit_log = AuditLog(
        action_type="WALLET_STATUS_CHANGE",
        entity_type="wallet",
        entity_id=wallet.id,
        user_identifier=admin_id,
        details={
            "old_status": old_status,
            "new_status": new_status,
            "reason": reason,
            "wallet_address": normalized_address
        }
    )
    database_session.add(audit_log)

    # Create alert for status change
    alert = Alert(
        wallet_address=normalized_address,
        alert_type="STATUS_CHANGED",
        severity="MEDIUM" if new_status == "under_review" else "HIGH",
        message=f"Wallet status changed from {old_status} to {new_status}. Reason: {reason}",
        risk_score=wallet.risk_score,
        meta={"old_status": old_status, "new_status": new_status, "changed_by": admin_id}
    )
    database_session.add(alert)

    database_session.commit()

    return {
        "success": True,
        "wallet_address": normalized_address,
        "old_status": old_status,
        "new_status": new_status,
        "updated_at": wallet.updated_at.isoformat()
    }


@app.get("/wallets/{wallet_address}/stats", tags=["Admin - Tracking"])
def get_wallet_stats(
    wallet_address: str,
    database_session: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get detailed wallet statistics including ETH sent/received.
    """
    normalized_address = wallet_address.lower().strip()

    # Calculate total ETH sent
    sent_result = database_session.query(
        func.sum(Transaction.value).label('total_sent'),
        func.count(Transaction.id).label('sent_count')
    ).filter(
        Transaction.from_address == normalized_address
    ).first()

    # Calculate total ETH received
    received_result = database_session.query(
        func.sum(Transaction.value).label('total_received'),
        func.count(Transaction.id).label('received_count')
    ).filter(
        Transaction.to_address == normalized_address
    ).first()

    total_sent_wei = int(sent_result.total_sent or 0) if sent_result else 0
    total_received_wei = int(received_result.total_received or 0) if received_result else 0
    sent_count = sent_result.sent_count or 0 if sent_result else 0
    received_count = received_result.received_count or 0 if received_result else 0

    # Get wallet info
    wallet = database_session.query(Wallet).filter(Wallet.address == normalized_address).first()

    return {
        "address": normalized_address,
        "eth_sent": _eth_from_wei(total_sent_wei),
        "eth_received": _eth_from_wei(total_received_wei),
        "eth_balance": _eth_from_wei(total_received_wei - total_sent_wei),
        "sent_count": sent_count,
        "received_count": received_count,
        "total_transactions": sent_count + received_count,
        "wallet_info": {
            "label": wallet.label if wallet else None,
            "entity_type": wallet.entity_type if wallet else "Unknown",
            "risk_score": float(wallet.risk_score or 0) if wallet else 0,
            "account_status": wallet.account_status if wallet else None
        } if wallet else None
    }


@app.get("/wallets/{wallet_address}/transactions", tags=["Admin - Tracking"])
def get_wallet_transactions(
    wallet_address: str,
    limit: int = 50,
    database_session: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get transaction history for a wallet.
    """
    normalized_address = wallet_address.lower().strip()

    # Get all transactions involving this wallet
    transactions = database_session.query(Transaction).filter(
        (Transaction.from_address == normalized_address) |
        (Transaction.to_address == normalized_address)
    ).order_by(Transaction.timestamp.desc()).limit(limit).all()

    tx_list = []
    for tx in transactions:
        direction = "sent" if tx.from_address == normalized_address else "received"
        counterparty = tx.to_address if direction == "sent" else tx.from_address

        # Get counterparty wallet info
        counterparty_wallet = database_session.query(Wallet).filter(
            Wallet.address == counterparty
        ).first()

        tx_list.append({
            "tx_hash": tx.tx_hash,
            "direction": direction,
            "counterparty": counterparty,
            "counterparty_label": counterparty_wallet.label if counterparty_wallet else None,
            "counterparty_risk": float(counterparty_wallet.risk_score or 0) if counterparty_wallet else 0,
            "value_eth": _eth_from_wei(int(tx.value or 0)),
            "block_number": tx.block_number,
            "timestamp": tx.timestamp.isoformat() if tx.timestamp else None,
            "is_flagged": tx.is_flagged,
            "flag_reason": tx.flag_reason
        })

    return {
        "address": normalized_address,
        "transactions": tx_list,
        "count": len(tx_list)
    }


@app.get("/wallets/{wallet_address}/connections", tags=["Admin - Tracking"])
def get_wallet_connections(
    wallet_address: str,
    database_session: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get all wallet connections (who this wallet interacted with).
    Used for the tracking page to show relationship graph.
    """
    normalized_address = wallet_address.lower().strip()

    # Get wallets this address sent to
    sent_to = database_session.query(
        Transaction.to_address,
        func.count(Transaction.id).label('tx_count'),
        func.sum(Transaction.value).label('total_value')
    ).filter(
        Transaction.from_address == normalized_address
    ).group_by(Transaction.to_address).all()

    # Get wallets this address received from
    received_from = database_session.query(
        Transaction.from_address,
        func.count(Transaction.id).label('tx_count'),
        func.sum(Transaction.value).label('total_value')
    ).filter(
        Transaction.to_address == normalized_address
    ).group_by(Transaction.from_address).all()

    # Enrich with wallet info
    connections = []
    for addr, tx_count, total_value in sent_to:
        if not addr:
            continue
        wallet_info = database_session.query(Wallet).filter(Wallet.address == addr).first()
        connections.append({
            "address": addr,
            "direction": "outgoing",
            "tx_count": tx_count,
            "total_value_eth": _eth_from_wei(int(total_value or 0)),
            "label": wallet_info.label if wallet_info else None,
            "entity_type": wallet_info.entity_type if wallet_info else "Unknown",
            "risk_score": float(wallet_info.risk_score or 0) if wallet_info else 0,
            "account_status": wallet_info.account_status if wallet_info else None
        })

    for addr, tx_count, total_value in received_from:
        if not addr:
            continue
        wallet_info = database_session.query(Wallet).filter(Wallet.address == addr).first()
        connections.append({
            "address": addr,
            "direction": "incoming",
            "tx_count": tx_count,
            "total_value_eth": _eth_from_wei(int(total_value or 0)),
            "label": wallet_info.label if wallet_info else None,
            "entity_type": wallet_info.entity_type if wallet_info else "Unknown",
            "risk_score": float(wallet_info.risk_score or 0) if wallet_info else 0,
            "account_status": wallet_info.account_status if wallet_info else None
        })

    # Get main wallet info
    main_wallet = database_session.query(Wallet).filter(Wallet.address == normalized_address).first()

    return {
        "wallet": {
            "address": normalized_address,
            "label": main_wallet.label if main_wallet else None,
            "risk_score": float(main_wallet.risk_score or 0) if main_wallet else 0,
            "entity_type": main_wallet.entity_type if main_wallet else "Unknown",
            "account_status": main_wallet.account_status if main_wallet else None
        },
        "connections": connections,
        "total_connections": len(connections)
    }


@app.get("/blocked-transfers", tags=["Admin - History"])
def get_blocked_transfers(
    limit: int = 100,
    database_session: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get history of all blocked transfers for audit purposes.
    """
    blocked = database_session.query(BlockedTransfer).order_by(
        BlockedTransfer.blocked_at.desc()
    ).limit(limit).all()

    # Statistics
    total_blocked = database_session.query(BlockedTransfer).count()
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    blocked_today = database_session.query(BlockedTransfer).filter(
        BlockedTransfer.blocked_at >= today_start
    ).count()

    total_value_blocked = database_session.query(
        func.sum(BlockedTransfer.amount)
    ).scalar() or 0

    return {
        "blocked_transfers": [
            {
                "id": str(b.id),
                "sender_address": b.sender_address,
                "receiver_address": b.receiver_address,
                "amount_eth": _eth_from_wei(int(b.amount or 0)),
                "risk_score": float(b.risk_score or 0),
                "block_reason": b.block_reason,
                "user_warning_count": b.user_warning_count,
                "blocked_at": b.blocked_at.isoformat() if b.blocked_at else None
            }
            for b in blocked
        ],
        "statistics": {
            "total_blocked": total_blocked,
            "blocked_today": blocked_today,
            "total_value_blocked_eth": _eth_from_wei(int(total_value_blocked))
        },
        "count": len(blocked)
    }


@app.get("/statistics/dashboard", tags=["Admin - Dashboard"])
def get_dashboard_statistics(
    database_session: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get comprehensive statistics for admin dashboard cards.
    """
    # Money laundering stats
    ml_wallets = database_session.query(Wallet).filter(
        Wallet.risk_category == 'money_laundering'
    ).count()
    ml_alerts = database_session.query(Alert).filter(
        Alert.alert_type.in_(['STRUCTURING_DETECTED', 'MIXER_INTERACTION', 'LAYERING_DETECTED'])
    ).count()

    # Manipulation stats
    manip_wallets = database_session.query(Wallet).filter(
        Wallet.risk_category == 'manipulation'
    ).count()
    manip_alerts = database_session.query(Alert).filter(
        Alert.alert_type.in_(['WASH_TRADING', 'PUMP_DUMP_DETECTED', 'CYCLE_DETECTED'])
    ).count()

    # Scam stats
    scam_wallets = database_session.query(Wallet).filter(
        Wallet.risk_category == 'scam'
    ).count()
    scam_alerts = database_session.query(Alert).filter(
        Alert.alert_type.in_(['BLACKLIST_MATCH', 'HONEYPOT_DETECTED', 'SCAM_PATTERN'])
    ).count()

    # General stats
    total_wallets = database_session.query(Wallet).count()
    total_alerts = database_session.query(Alert).count()
    critical_alerts = database_session.query(Alert).filter(Alert.severity == 'CRITICAL').count()
    total_blocked = database_session.query(BlockedTransfer).count()

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    alerts_today = database_session.query(Alert).filter(Alert.detected_at >= today_start).count()

    return {
        "money_laundering": {
            "wallet_count": ml_wallets,
            "alert_count": ml_alerts,
            "icon": "Droplets",
            "color": "blue"
        },
        "manipulation": {
            "wallet_count": manip_wallets,
            "alert_count": manip_alerts,
            "icon": "LineChart",
            "color": "orange"
        },
        "scam": {
            "wallet_count": scam_wallets,
            "alert_count": scam_alerts,
            "icon": "Fish",
            "color": "red"
        },
        "overview": {
            "total_wallets": total_wallets,
            "total_alerts": total_alerts,
            "critical_alerts": critical_alerts,
            "alerts_today": alerts_today,
            "total_blocked": total_blocked
        }
    }


@app.get("/statistics/flow", tags=["Admin - History"])
def get_money_flow_statistics(
    wallet_address: str = None,
    days: int = 7,
    database_session: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get money flow statistics (in/out) for charts.
    """
    from datetime import timedelta

    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    query = database_session.query(
        func.date(Transaction.timestamp).label('date'),
        func.sum(
            case(
                (Transaction.to_address == wallet_address, Transaction.value) if wallet_address else (True, Transaction.value),
                else_=0
            )
        ).label('inflow'),
        func.sum(
            case(
                (Transaction.from_address == wallet_address, Transaction.value) if wallet_address else (True, Transaction.value),
                else_=0
            )
        ).label('outflow')
    ).filter(
        Transaction.timestamp >= start_date
    )

    if wallet_address:
        query = query.filter(
            (Transaction.from_address == wallet_address) | (Transaction.to_address == wallet_address)
        )

    daily_flow = query.group_by(func.date(Transaction.timestamp)).order_by(func.date(Transaction.timestamp)).all()

    return {
        "flow_data": [
            {
                "date": str(row.date) if row.date else None,
                "inflow_eth": _eth_from_wei(int(row.inflow or 0)),
                "outflow_eth": _eth_from_wei(int(row.outflow or 0))
            }
            for row in daily_flow
        ],
        "period_days": days,
        "wallet_address": wallet_address
    }


# ==========================================
# USER WARNING SYSTEM (3 STRIKES)
# ==========================================

@app.post("/send-with-warning", tags=["Transaction"])
def send_eth_with_warning_system(
    payload: Dict[str, Any],
    database_session: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Enhanced send endpoint with 3-strike warning system.

    Flow:
    1. Check receiver risk
    2. If risky but not critical (50-80): Show warning, allow user to proceed
    3. If user proceeds despite warning: Record warning, increment count
    4. After 3 warnings: Auto-suspend sender account
    5. If critical (>80): Block immediately
    """
    sender = str(payload.get("sender", "")).lower().strip()
    receiver = str(payload.get("receiver", "")).lower().strip()
    amount = float(payload.get("amount", 0))
    force_proceed = payload.get("force_proceed", False)  # User clicked "proceed anyway"

    if not sender or not receiver:
        raise HTTPException(status_code=400, detail="sender and receiver are required")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    # Get sender's current warning count
    sender_wallet = database_session.query(Wallet).filter(Wallet.address == sender).first()
    if not sender_wallet:
        sender_wallet = Wallet(address=sender)
        database_session.add(sender_wallet)
        database_session.commit()
        database_session.refresh(sender_wallet)

    # Check if sender is already suspended
    if sender_wallet.account_status == 'suspended':
        raise HTTPException(
            status_code=403,
            detail="Your account is suspended due to multiple risk warnings. Contact support."
        )

    # Get current warning count for this sender
    warning_count = database_session.query(UserWarning).filter(
        UserWarning.wallet_address == sender
    ).count()

    # Check receiver risk
    blacklist_record = database_session.query(Blacklist).filter(Blacklist.address == receiver).first()
    receiver_wallet = database_session.query(Wallet).filter(Wallet.address == receiver).first()

    receiver_risk = 0.0
    receiver_status = "unknown"

    if blacklist_record:
        receiver_risk = 100.0
        receiver_status = "blacklisted"
    elif receiver_wallet:
        receiver_risk = float(receiver_wallet.risk_score or 0)
        receiver_status = receiver_wallet.account_status
    else:
        # Analyze receiver if not in DB
        tx_history = fetch_wallet_history(receiver, max_count=100)
        ai_engine = MultiAgentDetectionEngine(database_session=database_session)
        risk_analysis = ai_engine.analyze_wallet(wallet_address=receiver, transactions=tx_history)
        receiver_risk = float(risk_analysis.get("total_score", 0.0))

    # Critical risk (>80 or blacklisted) - Block immediately
    if receiver_risk >= 80 or blacklist_record or receiver_status in ['frozen', 'suspended']:
        # Record blocked transfer
        blocked = BlockedTransfer(
            sender_address=sender,
            receiver_address=receiver,
            amount=_wei_from_eth(amount),
            risk_score=receiver_risk,
            block_reason="high_risk_receiver",
            user_warning_count=warning_count
        )
        database_session.add(blocked)
        database_session.commit()

        raise HTTPException(
            status_code=403,
            detail={
                "blocked": True,
                "reason": "Receiver is high-risk or blocked",
                "receiver_risk": receiver_risk,
                "receiver_status": receiver_status
            }
        )

    # Medium risk (50-80) - Show warning
    if receiver_risk >= 50 and not force_proceed:
        return {
            "status": "warning",
            "requires_confirmation": True,
            "receiver_risk": receiver_risk,
            "current_warnings": warning_count,
            "max_warnings": 3,
            "message": f"⚠️ This wallet has a risk score of {receiver_risk}%. Are you sure you want to proceed?",
            "warning_text": f"You have {3 - warning_count} warnings remaining before account suspension."
        }

    # User chose to proceed despite warning
    if force_proceed and receiver_risk >= 50:
        # Record warning
        new_warning = UserWarning(
            wallet_address=sender,
            target_address=receiver,
            warning_type="RISK_IGNORED",
            risk_score=receiver_risk,
            user_action="ignored",
            warning_number=warning_count + 1
        )
        database_session.add(new_warning)
        warning_count += 1

        # Check if 3 strikes reached
        if warning_count >= 3:
            sender_wallet.account_status = 'suspended'
            sender_wallet.flagged_at = datetime.utcnow()
            sender_wallet.flagged_by = 'SYSTEM_AUTO_SUSPEND'
            sender_wallet.notes = f"{sender_wallet.notes or ''}\n[{datetime.utcnow().isoformat()}] Auto-suspended after 3 risk warnings."

            # Create alert for admin
            suspend_alert = Alert(
                wallet_address=sender,
                alert_type="USER_SUSPENDED",
                severity="HIGH",
                message=f"User account auto-suspended after ignoring 3 risk warnings. Last attempted transfer to {receiver}.",
                risk_score=receiver_risk,
                meta={
                    "warning_count": warning_count,
                    "last_target": receiver,
                    "last_risk": receiver_risk
                }
            )
            database_session.add(suspend_alert)
            database_session.commit()

            raise HTTPException(
                status_code=403,
                detail={
                    "suspended": True,
                    "reason": "Account suspended after 3 ignored risk warnings",
                    "warning_count": warning_count
                }
            )

        database_session.commit()

    # Proceed with transaction (low risk or user accepted warning)
    amount_wei = _wei_from_eth(amount)

    # Check balance
    sender_received_wei = database_session.query(
        func.coalesce(func.sum(Transaction.value), 0)
    ).filter(Transaction.to_address == sender).scalar()

    sender_sent_wei = database_session.query(
        func.coalesce(func.sum(Transaction.value), 0)
    ).filter(Transaction.from_address == sender).scalar()

    sender_balance_wei = int(sender_received_wei or 0) - int(sender_sent_wei or 0)

    if sender_balance_wei < amount_wei:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    # Create transaction
    import uuid as uuid_module
    tx_hash = f"sim_{uuid_module.uuid4().hex}"
    tx = Transaction(
        tx_hash=tx_hash,
        from_address=sender,
        to_address=receiver,
        value=amount_wei,
        block_number=0,
        timestamp=datetime.utcnow(),
        gas_price=0,
        gas_used=0,
        input_data="0x",
        status=1
    )
    database_session.add(tx)

    # Update wallets
    sender_wallet.total_value_sent = int(sender_wallet.total_value_sent or 0) + amount_wei
    sender_wallet.total_transactions = int(sender_wallet.total_transactions or 0) + 1
    sender_wallet.last_activity_at = datetime.utcnow()

    if not receiver_wallet:
        receiver_wallet = Wallet(address=receiver)
        database_session.add(receiver_wallet)

    receiver_wallet.total_value_received = int(receiver_wallet.total_value_received or 0) + amount_wei
    receiver_wallet.total_transactions = int(receiver_wallet.total_transactions or 0) + 1
    receiver_wallet.last_activity_at = datetime.utcnow()

    database_session.commit()

    # Calculate new balance
    new_balance_wei = sender_balance_wei - amount_wei

    return {
        "status": "success",
        "tx_hash": tx_hash,
        "from": sender,
        "to": receiver,
        "amount_eth": amount,
        "receiver_risk_score": receiver_risk,
        "warning_count": warning_count,
        "sender_balance_eth": _eth_from_wei(new_balance_wei),
        "message": "Transaction completed successfully" + (f" (Warning #{warning_count} recorded)" if force_proceed and receiver_risk >= 50 else "")
    }
