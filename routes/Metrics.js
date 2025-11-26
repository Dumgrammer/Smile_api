const express = require('express');
const router = express.Router();
const MetricsController = require('../controllers/Metrics');

router.get('/', MetricsController.getMetrics);
router.post('/', MetricsController.getMetrics);

module.exports = router;

