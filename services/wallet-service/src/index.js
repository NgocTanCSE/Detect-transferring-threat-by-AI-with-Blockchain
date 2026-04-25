const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'wallet-service' });
});

// TODO: Wallet endpoints

app.listen(PORT, () => {
  console.log(`✓ Wallet Service running on port ${PORT}`);
});
