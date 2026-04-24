const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

// Route for getting transactions
router.get('/:wallet_address', transactionController.getWalletTransactions);

// Route for analyzing wallet risk
router.get('/analyze/:wallet_address', transactionController.analyzeWallet);

module.exports = router;
