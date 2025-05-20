const express = require('express');
require('dotenv').config();
const router = express.Router();

const adminController = require('../controllers/Admin');
const { protect, authorize } = require('../middleware/auth');
const { loginLimiter, apiLimiter } = require('../middleware/rateLimit');

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

module.exports = router;