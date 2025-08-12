const express = require('express');
const router = express.Router();
const inquiryController = require('../controllers/Inquiry');
const { protect } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');

// Public routes
router.post('/submit', apiLimiter, inquiryController.createInquiry);

// Protected routes (admin only)
router.get('/', protect, inquiryController.getAllInquiries);
router.get('/stats', protect, inquiryController.getInquiryStats);
router.get('/:id', protect, inquiryController.getInquiryById);
router.put('/:id/status', protect, inquiryController.updateInquiryStatus);
router.put('/:id/archive', protect, inquiryController.archiveInquiry);
router.put('/:id/unarchive', protect, inquiryController.unarchiveInquiry);
router.post('/:id/reply', protect, inquiryController.replyToInquiry);
router.delete('/:id', protect, inquiryController.deleteInquiry);

module.exports = router;
