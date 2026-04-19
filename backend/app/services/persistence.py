import logging
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models.models import Transaction, TokenTransfer

logger = logging.getLogger(__name__)

def persist_transactions(
    database_session: Session,
    transactions: List[Dict[str, Any]],
    wallet_address: str = None
) -> Dict[str, int]:
    """
    Persist transaction data to database with deduplication.
    
    Saves both ETH transactions and ERC20 token transfers to appropriate tables.
    
    Args:
        database_session: Database session
        transactions: List of transaction dictionaries from Alchemy
        wallet_address: Optional wallet address context for logging
        
    Returns:
        Dictionary with counts of persisted records
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
        if eth_count > 0 or token_count > 0:
            database_session.commit()
            logger.info(f"Persisted {eth_count} transactions and {token_count} token transfers")
        return {"eth_count": eth_count, "token_count": token_count}
    except IntegrityError as integrity_error:
        database_session.rollback()
        logger.debug(f"Duplicate records ignored: {integrity_error}")
        return {"eth_count": 0, "token_count": 0}
    except Exception as e:
        database_session.rollback()
        logger.error(f"Persistence error: {e}")
        return {"eth_count": 0, "token_count": 0}
