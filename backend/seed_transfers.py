"""Seed additional transfer demo data: extra token transfers and risk assessments.
Must be run after seed_wallets.py.
Idempotent – safe to re-run.
"""

import uuid
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import models as m
from app.core.database import engine, Base


def _uuid_str() -> str:
    return str(uuid.uuid4())


def _random_eth_address() -> str:
    return "0x" + "".join(random.choices("0123456789abcdef", k=40))


def _random_tx_hash() -> str:
    return "0x" + "".join(random.choices("0123456789abcdef", k=64))


def _random_past_date(days_ago: int = 365) -> datetime:
    return datetime.now(timezone.utc) - timedelta(
        days=random.randint(0, days_ago),
        hours=random.randint(0, 23),
    )


def seed():
    Base.metadata.create_all(bind=engine)
    session: Session = Session(bind=engine)
    try:
        _seed_extra_token_transfers(session)
        _seed_extra_risk_assessments(session)
        session.commit()
        print("Transfer seed complete: 500 extra token transfers, 200 extra risk assessments")
    except Exception as e:
        session.rollback()
        print(f"Transfer seed failed: {e}")
        raise
    finally:
        session.close()


def _seed_extra_token_transfers(session: Session):
    existing_count = session.query(m.TokenTransfer).count()
    if existing_count >= 1000:
        return
    wallets = session.query(m.Wallet).all()
    orgs = session.query(m.Organization).all()
    if not wallets:
        print("  Wallets empty; skipping token transfers")
        return

    symbols = ["ETH", "USDT", "USDC", "DAI", "WBTC", "LINK", "UNI", "AAVE", "MATIC", "BNB", "SHIB", "PEPE"]
    chains = ["ethereum", "bsc"]
    tx_count = min(500, 1000 - existing_count)

    for i in range(tx_count):
        from_wallet = random.choice(wallets)
        to_wallet = random.choice(wallets)
        while to_wallet.address == from_wallet.address and len(wallets) > 1:
            to_wallet = random.choice(wallets)
        ttf = m.TokenTransfer(
            id=_uuid_str(),
            transaction_hash=_random_tx_hash(),
            block_number=random.randint(10000000, 20000000),
            log_index=random.randint(0, 200),
            token_address=_random_eth_address(),
            token_symbol=random.choice(symbols),
            token_name=f"{random.choice(symbols)}",
            token_decimals=18,
            from_address=from_wallet.address,
            to_address=to_wallet.address,
            value=str(random.randint(1, 10**16)),
            value_decimal=round(random.uniform(0.0001, 50000), 18),
            transfer_type=random.choices(["ERC20", "ERC721"], weights=[90, 10], k=1)[0],
            organization_id=random.choice(orgs).id if orgs else None,
            timestamp=_random_past_date(90),
        )
        session.add(ttf)
    session.flush()
    print(f"  Extra TokenTransfers: {tx_count} added")


def _seed_extra_risk_assessments(session: Session):
    existing_count = session.query(m.RiskAssessment).count()
    if existing_count >= 500:
        return
    wallets = session.query(m.Wallet).filter(m.Wallet.risk_score > 0).all()
    if not wallets:
        return
    levels = ["LOW", "LOW", "MEDIUM", "HIGH", "CRITICAL"]
    target = min(200, 500 - existing_count)
    count = 0
    for wallet in wallets:
        if count >= target:
            break
        score = wallet.risk_score
        if score <= 0:
            continue
        ra = m.RiskAssessment(
            id=_uuid_str(),
            wallet_id=wallet.id,
            score=score,
            risk_level=random.choices(levels, weights=[30, 30, 20, 15, 5], k=1)[0],
            details={
                "source": "bulk_seed",
                "cycle_score": round(random.uniform(0, 100), 2),
                "mixer_score": round(random.uniform(0, 100), 2),
                "ml_confidence": round(random.uniform(0.5, 1.0), 2),
            },
            model_version="v1.1",
            assessed_at=_random_past_date(60),
        )
        session.add(ra)
        count += 1
    session.flush()
    print(f"  Extra RiskAssessments: {count} added")


if __name__ == "__main__":
    seed()
