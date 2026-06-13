const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const queue = require('./services/queue');
require('dotenv').config();
const traceMiddleware = require('../../shared/trace');
const { client, requestMetrics } = require('../../shared/metrics');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // In production, restrict to frontend URL
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3007;

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
    clients: io.engine.clientsCount,
    dlq_metrics: { main: 0, dead: 0 }
  });
});
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
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

// Initialize
const start = async () => {
  // Start consuming from RabbitMQ
  await queue.startConsuming(handleMQEvent);

  server.listen(PORT, () => {
    console.log(`🚀 Event Service (WebSocket) running on port ${PORT}`);
  });
};

start();
