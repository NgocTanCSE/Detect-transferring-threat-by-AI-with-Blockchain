const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://backend:8000';
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
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

function toUpstreamPath(originalPath) {
  if (!originalPath) {
    return '/';
  }

  if (originalPath === '/api') {
    return '/';
  }

  if (originalPath.startsWith('/api/')) {
    return originalPath.slice(4);
  }

  return originalPath;
}

function getForwardHeaders(headers) {
  const filtered = { ...headers };
  delete filtered.host;
  delete filtered.connection;
  delete filtered['content-length'];
  return filtered;
}

// Fallback proxy: forward all unhandled routes to Python backend.
app.use(async (req, res) => {
  if (req.path === '/health') {
    return res.status(404).json({ error: 'Not found' });
  }

  const upstreamPath = toUpstreamPath(req.path);
  const query = new URLSearchParams(req.query || {}).toString();
  const upstreamUrl = `${AI_SERVICE_URL}${upstreamPath}${query ? `?${query}` : ''}`;

  try {
    const response = await axios({
      method: req.method,
      url: upstreamUrl,
      headers: getForwardHeaders(req.headers),
      data: ['GET', 'DELETE'].includes(req.method.toUpperCase()) ? undefined : req.body,
      responseType: 'arraybuffer',
      validateStatus: () => true,
      timeout: 30000,
    });

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

const PORT = process.env.PORT || 8001;
server.listen(PORT, () => {
  console.log(`Node.js Orchestrator running on port ${PORT}`);
});
