const express = require('express');
const router = express.Router();
const logController = require('../controllers/Logs');
const { protect } = require('../middleware/auth');

// All routes are protected (admin only)
router.use(protect);

// Create a log entry
router.post('/', logController.createLog);

// Get all logs with filters
router.get('/', logController.getAllLogs);

// Get log statistics
router.get('/stats', logController.getLogStats);

// Get logs by admin
router.get('/admin/:adminId', logController.getLogsByAdmin);

// Get logs by entity
router.get('/entity/:entityType/:entityId', logController.getLogsByEntity);

// Delete old logs (cleanup)
router.delete('/cleanup', logController.deleteOldLogs);

module.exports = router;
