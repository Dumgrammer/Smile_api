const express = require('express');
require('dotenv').config();
const router = express.Router();

const adminController = require('../controllers/Admin');
const { protect, authorize } = require('../middleware/auth');
const { loginLimiter, apiLimiter } = require('../middleware/rateLimit');
const DashboardController = require('../controllers/Dashboard');

// Public routes (rate limited)
router.post('/login', loginLimiter, adminController.loginAdmin);
router.post('/refresh-token', loginLimiter, adminController.refreshToken);

// Protected routes
router.post('/logout', protect, adminController.logoutAdmin);

// Admin management
// TEMPORARY: Removed protection for first admin registration
// router.post('/register', adminController.registerAdmin);

// After the first admin is created, you should revert to the protected route:
router.post('/register', [protect, authorize('superadmin'), apiLimiter], adminController.registerAdmin);

// Dashboard stats route
router.get('/dashboard/stats', DashboardController.getStats);
// Dashboard revenue trend route
router.get('/dashboard/revenue-trend', DashboardController.getRevenueTrend);

module.exports = router;