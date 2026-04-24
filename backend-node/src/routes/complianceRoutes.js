const express = require('express');
const router = express.Router();
const complianceController = require('../controllers/complianceController');
const transactionController = require('../controllers/transactionController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Policy Rules (Compliance Manager & Admin only)
router.get('/policy-rules', protect, complianceController.getPolicyRules);
router.post('/policy-rules', protect, authorize('admin', 'analyst'), complianceController.createPolicyRule);
router.put('/policy-rules/:id', protect, authorize('admin', 'analyst'), complianceController.updatePolicyRule);
router.delete('/policy-rules/:id', protect, authorize('admin'), complianceController.deletePolicyRule);

// Transactions (Re-mounting from transactionController for consistency in /ops/compliance path)
router.get('/transactions/:wallet_address', protect, transactionController.getWalletTransactions);
router.post('/analyze/:wallet_address', protect, transactionController.analyzeWallet);

module.exports = router;
