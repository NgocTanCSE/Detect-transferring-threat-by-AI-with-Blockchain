"""Seed data for System Admin role - 1000+ records."""

import uuid
import random
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.models import models as m
from app.core.database import engine, Base


def seed():
    Base.metadata.create_all(bind=engine)
    session: Session = Session(bind=engine)
    try:
        # Node endpoints - 5
        chains = ["ethereum", "bsc"]
        for chain in chains:
            for _ in range(3):
                node = m.NodeEndpoint(
                    id=str(uuid.uuid4()),
                    provider_name=f"alchemy_{chain}",
                    chain=chain,
                    endpoint_url=f"https://{chain}-mainnet.g.alchemy.com/v2/demo",
                    protocol="https",
                    priority=1,
                    is_active=True,
                    health_status="healthy",
                    last_checked_at=datetime.now(timezone.utc) - timedelta(minutes=random.randint(0, 30))
                )
                session.merge(node)

        # Pipeline metrics - 1000 records
        for i in range(1000):
            metric = m.PipelineMetric(
                id=str(uuid.uuid4()),
                chain=random.choice(chains),
                block_number=random.randint(20000000, 21000000),
                throughput_tps=random.uniform(5.0, 50.0),
                ingestion_latency_ms=random.randint(100, 500),
                decode_latency_ms=random.randint(50, 200),
                inserted_at=datetime.now(timezone.utc) - timedelta(hours=i%24)
            )
            session.add(metric)

        # Diagnostic events - 1000 records
        log_types = ["info", "warning", "error", "api_call"]
        for i in range(1000):
            event = m.DiagnosticEvent(
                id=str(uuid.uuid4()),
                log_type=random.choice(log_types),
                message=f"System event {i}",
                status_code=random.choice([200, 200, 200, 400, 500]),
                endpoint=f"/api/ops/{random.choice(['health', 'metrics', 'wallets'])}",
                source="backend",
                timestamp=datetime.now(timezone.utc) - timedelta(hours=i%24)
            )
            session.add(event)

        session.commit()
        print(f"Seeded: 6 nodes, 1000 pipeline metrics, 1000 diagnostic events")
    except Exception as e:
        session.rollback()
        print(f"Seed failed: {e}")
    finally:
        session.close()


if __name__ == "__main__":
    seed()