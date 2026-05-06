import uuid
import random
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, DATABASE_URL
from app.models.models import (
    Organization, User, Wallet, Transaction, 
    Alert, PolicyRule, AuditLog, NodeEndpoint
)

# Setup database session
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def seed_data():
    print("Starting Multi-Tenant Seeding...")

    # 1. Create Organizations
    org_gbv = Organization(
        id=uuid.uuid4(),
        name="Global Bank Vietnam",
        slug="gbv",
        contact_email="admin@gbv.com",
        is_active=True
    )
    org_dntu = Organization(
        id=uuid.uuid4(),
        name="DNTU Exchange",
        slug="dntu",
        contact_email="security@dntu.edu.vn",
        is_active=True
    )
    db.add_all([org_gbv, org_dntu])
    db.flush()

    # 2. Create Users
    # System Admin
    sys_admin = User(
        username="sysadmin",
        email="admin@sentinel.ai",
        password_hash="admin123", # For dev purposes
        role="system_admin",
        is_active=True
    )
    # GBV Analyst
    gbv_analyst = User(
        username="gbv_analyst",
        email="analyst@gbv.com",
        password_hash="gbv123",
        role="security_analyst",
        organization_id=org_gbv.id,
        is_active=True
    )
    # DNTU Compliance
    dntu_compliance = User(
        username="dntu_risk",
        email="risk@dntu.edu.vn",
        password_hash="dntu123",
        role="compliance_risk_manager",
        organization_id=org_dntu.id,
        is_active=True
    )
    db.add_all([sys_admin, gbv_analyst, dntu_compliance])
    db.flush()

    # 3. Create Node Endpoints (Global)
    nodes = [
        NodeEndpoint(id=1, provider_name="Alchemy Primary", chain="ethereum", endpoint_url="https://eth-mainnet.g.alchemy.com/v2/demo", priority=10),
        NodeEndpoint(id=2, provider_name="Infura Backup", chain="ethereum", endpoint_url="https://mainnet.infura.io/v3/demo", priority=20)
    ]
    db.add_all(nodes)

    # 4. Create Policy Rules (Per Org)
    rules = [
        PolicyRule(id=1, rule_name="GBV High Risk Block", organization_id=org_gbv.id, min_risk_score=85.0, block_blacklisted=True),
        PolicyRule(id=2, rule_name="DNTU Standard Compliance", organization_id=org_dntu.id, min_risk_score=75.0, block_blacklisted=True)
    ]
    db.add_all(rules)

    # 5. Create Sample Wallets & Transactions
    for org in [org_gbv, org_dntu]:
        print(f"Seeding data for {org.name}...")
        for i in range(5):
            addr = "0x" + uuid.uuid4().hex[:40]
            wallet = Wallet(
                id=random.randint(1000, 999999),
                address=addr,
                label=f"{org.slug}_wallet_{i}",
                organization_id=org.id,
                risk_score=random.uniform(0, 100),
                total_transactions=random.randint(10, 100)
            )
            db.add(wallet)
            db.flush()

            # Add a transaction for this wallet
            tx = Transaction(
                id=random.randint(1000, 999999),
                tx_hash="0x" + uuid.uuid4().hex + uuid.uuid4().hex,
                from_address="0x" + uuid.uuid4().hex[:40],
                to_address=addr,
                value=Decimal(str(random.uniform(0.1, 5.0) * 10**18)),
                organization_id=org.id,
                case_status="PENDING",
                timestamp=datetime.utcnow() - timedelta(hours=random.randint(1, 48))
            )
            db.add(tx)

            # Add an alert if risk is high
            if wallet.risk_score > 70:
                alert = Alert(
                    id=random.randint(1000, 999999),
                    wallet_address=addr,
                    alert_type="HIGH_RISK_INFLOW",
                    severity="HIGH" if wallet.risk_score > 85 else "MEDIUM",
                    message=f"Suspicious activity detected for {org.name} client",
                    risk_score=wallet.risk_score,
                    organization_id=org.id
                )
                db.add(alert)

    db.commit()
    print("Multi-Tenant Seeding Completed Successfully!")

if __name__ == "__main__":
    try:
        seed_data()
    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()
