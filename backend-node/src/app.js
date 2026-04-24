const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { port, frontendUrl } = require('./config/env');
const { forwardRequest } = require('./services/upstreamProxyService');
const alertMonitorService = require('./services/alertMonitorService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: frontendUrl,
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Middleware to attach io to req for controllers
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'Node.js Backend is healthy', timestamp: new Date() });
});

// Routes
const transactionRoutes = require('./routes/transactionRoutes');

// Orchestrated routes (support both with and without /api prefix).
app.use('/ops/compliance', transactionRoutes);
app.use('/api/ops/compliance', transactionRoutes);

alertMonitorService.start(io);

// Fallback proxy: forward all unhandled routes to Python backend.
app.use(async (req, res) => {
  if (req.path === '/health') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const response = await forwardRequest(req);

    const contentType = response.headers['content-type'];
    if (contentType) {
      res.setHeader('content-type', contentType);
    }

    return res.status(response.status).send(response.data);
  } catch (error) {
    console.error('Proxy forwarding failed:', error.message);
    return res.status(502).json({ error: 'Upstream AI service unavailable' });
  }
});

server.listen(port, () => {
  console.log(`Node.js Orchestrator running on port ${port}`);
});

const shutdown = () => {
  alertMonitorService.stop();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
