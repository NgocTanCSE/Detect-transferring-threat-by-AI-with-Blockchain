const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
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
app.use('/api/ops/compliance/transactions', transactionRoutes);
app.use('/api/ops/compliance/analyze', transactionRoutes); // Alias for analysis

const PORT = process.env.PORT || 8001;
server.listen(PORT, () => {
  console.log(`Node.js Orchestrator running on port ${PORT}`);
});
