const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, alertController.getAlerts);
router.get('/summary', protect, alertController.getAlertSummary);
router.post('/:id/acknowledge', protect, alertController.acknowledgeAlert);

module.exports = router;
