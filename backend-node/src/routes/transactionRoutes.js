const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

// Route for analyzing wallet risk
router.get('/analyze/:wallet_address', transactionController.analyzeWallet);

// Route for getting transactions
router.get('/transactions/:wallet_address', transactionController.getWalletTransactions);

module.exports = router;
