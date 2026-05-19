# Service Templates - Node.js

## Node.js Service Dockerfile Template

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "src/index.js"]
```

## Node.js Service package.json Template

```json
{
  "name": "@blockchain-ai/service-template",
  "version": "1.0.0",
  "description": "Microservice template",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/",
    "format": "prettier --write src/"
  },
  "dependencies": {
    "express": "^4.18.2",
    "dotenv": "^16.0.3",
    "pg": "^8.10.0",
    "amqplib": "^0.10.3",
    "axios": "^1.4.0",
    "joi": "^17.9.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.5.0",
    "supertest": "^6.3.3",
    "eslint": "^8.43.0",
    "prettier": "^2.8.8"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## Node.js Service src/index.js Template

```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'SERVICE_NAME', timestamp: new Date().toISOString() });
});

// Ready check (dependencies)
app.get('/ready', async (req, res) => {
  try {
    // Check database
    // Check message queue
    // Check external services
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

// API Routes
app.use('/api/v1', require('./routes'));

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    requestId: req.id
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Service started on port ${PORT}`);
});

module.exports = app;
```

## src/routes/index.js Template

```javascript
const express = require('express');
const router = express.Router();

// Example routes
router.get('/', (req, res) => {
  res.json({ service: 'SERVICE_NAME', version: '1.0.0' });
});

router.post('/action', async (req, res) => {
  try {
    // Business logic
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

## src/middleware/auth.js Template

```javascript
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    // Verify token
    req.user = { id: 'user_id' }; // Decode JWT
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

module.exports = { verifyToken };
```

## src/services/database.js Template

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};
```

## src/services/queue.js Template

```javascript
const amqp = require('amqplib');

let connection;
let channel;

const connect = async () => {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    console.log('✓ Connected to RabbitMQ');
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
    setTimeout(connect, 5000);
  }
};

const publish = async (queue, message) => {
  try {
    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });
  } catch (error) {
    console.error('Failed to publish:', error);
  }
};

const subscribe = async (queue, callback) => {
  try {
    await channel.assertQueue(queue, { durable: true });
    channel.consume(queue, async (msg) => {
      const content = JSON.parse(msg.content.toString());
      await callback(content);
      channel.ack(msg);
    });
  } catch (error) {
    console.error('Failed to subscribe:', error);
  }
};

module.exports = { connect, publish, subscribe };
```

## .env.example Template

```
# Service Configuration
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://blockchain:blockchain123@postgres_main:5432/blockchain_main

# RabbitMQ
RABBITMQ_URL=amqp://admin:admin123@rabbitmq:5672

# External Services
AUTH_SERVICE_URL=http://auth-service:3001
ALERT_SERVICE_URL=http://alert-service:3003
WALLET_SERVICE_URL=http://wallet-service:3002
TRANSFER_SERVICE_URL=http://transfer-service:3004
ANALYTICS_SERVICE_URL=http://analytics-service:3005
COMPLIANCE_SERVICE_URL=http://compliance-service:3006
EVENT_SERVICE_URL=http://event-service:3007

# Security
JWT_SECRET=your_secret_key_here
JWT_EXPIRY=7d

# API Keys
ALCHEMY_API_KEY=your_alchemy_key
ETHERSCAN_API_KEY=your_etherscan_key
```
