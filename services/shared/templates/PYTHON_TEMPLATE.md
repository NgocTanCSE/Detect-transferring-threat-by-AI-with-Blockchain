# Service Templates - Python (FastAPI)

## Python Service Dockerfile Template

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 3005

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD python -c "import requests; requests.get('http://localhost:3005/health')"

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3005"]
```

## Python Service requirements.txt Template

```
fastapi==0.104.0
uvicorn==0.24.0
python-dotenv==1.0.0
psycopg2-binary==2.9.9
sqlalchemy==2.0.23
pydantic==2.5.0
aiohttp==3.9.0
pika==1.3.2
requests==2.31.0
python-multipart==0.0.6
```

## Python Service src/main.py Template

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from src.core.config import settings
from src.core.database import engine, Base
from src.routes import router

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up service...")
    Base.metadata.create_all(bind=engine)
    yield
    # Shutdown
    logger.info("Shutting down service...")

app = FastAPI(
    title="Analytics Service",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "analytics",
        "version": "1.0.0"
    }

@app.get("/ready")
async def ready():
    try:
        # Check database, message queue, etc.
        return {"status": "ready"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

app.include_router(router, prefix="/api/v1")
```

## Python Service src/core/config.py Template

```python
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Service
    PORT: int = 3005
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql://blockchain:blockchain123@localhost:5432/blockchain_main"

    # RabbitMQ
    RABBITMQ_URL: str = "amqp://admin:admin123@localhost:5672"

    # External services
    AUTH_SERVICE_URL: str = "http://auth-service:3001"
    ALERT_SERVICE_URL: str = "http://alert-service:3003"
    ANALYTICS_SERVICE_URL: str = "http://analytics-service:3005"

    # API Keys
    ALCHEMY_API_KEY: Optional[str] = None
    ETHERSCAN_API_KEY: Optional[str] = None

    class Config:
        env_file = ".env"

settings = Settings()
```

## Python Service src/core/database.py Template

```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from src.core.config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

## Python Service src/models.py Template

```python
from sqlalchemy import Column, Integer, String, DateTime, Float
from sqlalchemy.sql import func
from src.core.database import Base

class Analytics(Base):
    __tablename__ = "analytics"

    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(100), index=True)
    chain_id = Column(String(50), default="ethereum", index=True)
    metric_type = Column(String(100))
    value = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    class Config:
        from_attributes = True
```

## Python Service src/routes/__init__.py Template

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.core.database import get_db

router = APIRouter()

@router.get("/")
async def root():
    return {"service": "analytics", "version": "1.0.0"}

@router.get("/analyze/{wallet_address}")
async def analyze(wallet_address: str, chain: str = "ethereum", db: Session = Depends(get_db)):
    # Business logic
    return {"wallet": wallet_address, "chain": chain, "analysis": {}}
```

## Python Service src/services/queue.py Template

```python
import pika
import json
import asyncio
from typing import Callable

class MessageQueue:
    def __init__(self, rabbitmq_url: str):
        self.rabbitmq_url = rabbitmq_url
        self.connection = None
        self.channel = None

    async def connect(self):
        try:
            self.connection = pika.BlockingConnection(pika.URLParameters(self.rabbitmq_url))
            self.channel = self.connection.channel()
            print("✓ Connected to RabbitMQ")
        except Exception as e:
            print(f"Failed to connect: {e}")
            await asyncio.sleep(5)
            await self.connect()

    async def publish(self, queue_name: str, message: dict):
        try:
            self.channel.queue_declare(queue=queue_name, durable=True)
            self.channel.basic_publish(
                exchange='',
                routing_key=queue_name,
                body=json.dumps(message)
            )
        except Exception as e:
            print(f"Failed to publish: {e}")

    async def subscribe(self, queue_name: str, callback: Callable):
        try:
            self.channel.queue_declare(queue=queue_name, durable=True)
            self.channel.basic_consume(
                queue=queue_name,
                on_message_callback=callback,
                auto_ack=False
            )
            self.channel.start_consuming()
        except Exception as e:
            print(f"Failed to subscribe: {e}")

    def disconnect(self):
        if self.connection:
            self.connection.close()
```

## .env.example Template (Python)

```
# Service Configuration
PORT=3005
DEBUG=False

# Database
DATABASE_URL=postgresql://blockchain:blockchain123@postgres_main:5432/blockchain_main

# RabbitMQ
RABBITMQ_URL=amqp://admin:admin123@rabbitmq:5672

# External Services
AUTH_SERVICE_URL=http://auth-service:3001
ALERT_SERVICE_URL=http://alert-service:3003
WALLET_SERVICE_URL=http://wallet-service:3002
TRANSFER_SERVICE_URL=http://transfer-service:3004
COMPLIANCE_SERVICE_URL=http://compliance-service:3006

# API Keys
ALCHEMY_API_KEY=your_alchemy_key
ETHERSCAN_API_KEY=your_etherscan_key
```
