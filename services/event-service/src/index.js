const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const queue = require('./services/queue');
require('dotenv').config();
const traceMiddleware = require('../../shared/trace');
const { client, requestMetrics } = require('../../shared/metrics');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3007;
const JWT_SECRET = process.env.JWT_SECRET_KEY || 'default-secret-change-in-production';

// Authenticate JWT token middleware for Socket.io
const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1] || socket.handshake.query.token;
  
  // Allow connection if AUTH_DISABLED is true
  if (process.env.AUTH_DISABLED === 'true') {
    return next();
  }

  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
};

app.use(helmet());
app.use(cors());
app.use(express.json());

// Tracing middleware
app.use(traceMiddleware);
app.use(requestMetrics);

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${req.correlationId}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'event-service', 
    clients: io.engine.clientsCount
  });
});

// Ready check
app.get('/ready', async (req, res) => {
  try {
    const mqReady = await queue.isConnected();
    if (!mqReady) {
      return res.status(503).json({ status: 'not ready', reason: 'RabbitMQ not connected' });
    }
    res.json({ status: 'ready', service: 'event-service' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// Apply authentication middleware to all socket connections (must be before io.on)
io.use(authenticateSocket);

// Socket.io connection handling with JWT authentication
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}${socket.user ? ` (user: ${socket.user.username || 'unknown'})` : ' (unauthenticated)'}`);
  
  // Example: Client joining a specific chain room
  socket.on('join-chain', (chain) => {
    socket.join(`chain:${chain}`);
    console.log(`👤 Client ${socket.id} joined room: chain:${chain}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

/**
 * Handle incoming events from RabbitMQ
 */
const handleMQEvent = (routingKey, data) => {
  // Broadcast to all clients (original new-alert format)
  io.emit('new-alert', data);
  
  // Map fields to match what the frontend expects for new-threat
  const threat = {
    chain: data.chain_id || 'ethereum',
    address: data.wallet_address || '',
    level: data.severity || 'MEDIUM',
    score: Number(data.risk_score || 0),
    timestamp: data.detected_at || new Date().toISOString()
  };
  io.emit('new-threat', threat);
  
  // Also broadcast to specific chain room if chain_id exists
  if (data.chain_id) {
    io.to(`chain:${data.chain_id}`).emit('new-alert', data);
    io.to(`chain:${data.chain_id}`).emit('new-threat', threat);
  }
  
  console.log(`📢 Broadcasted event ${routingKey} to ${io.engine.clientsCount} clients`);
};

// Centralized error handler
app.use((err, req, res, next) => {
  console.error(`[${req.correlationId || 'no-id'}] Unhandled error:`, err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// Initialize
const start = async () => {
  // Start consuming from RabbitMQ
  await queue.startConsuming(handleMQEvent);

  server.listen(PORT, () => {
    console.log(`🚀 Event Service (WebSocket) running on port ${PORT}`);
  });
};

start();
