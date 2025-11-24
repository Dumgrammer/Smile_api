const express = require('express');
const router = express.Router();
const PatientController = require('../controllers/Patient');
const { protect } = require('../middleware/auth');
const { loginLimiter, apiLimiter } = require('../middleware/rateLimit');

// Apply API rate limiter to all routes in this router
router.use(apiLimiter);

// Patient CRUD routes
router.post('/', protect, PatientController.createPatient);
router.get('/', protect, PatientController.getAllPatients);
router.post('/search', PatientController.searchPatients); // Public access for appointment booking
router.post('/verify', PatientController.verifyCode); // Public access for code verification

// Archive/Restore routes (MUST come before parameterized routes)
router.patch('/archive-multiple', protect, PatientController.archiveMultiplePatients);
router.patch('/restore-multiple', protect, PatientController.restoreMultiplePatients);

// Parameterized routes (MUST come after specific routes)
router.get('/:patientId', protect, PatientController.getPatientById);
router.patch('/:patientId', protect, PatientController.updatePatient);
router.delete('/:patientId', protect, PatientController.deletePatient);
router.delete('/:patientId/permanent', protect, PatientController.hardDeletePatient);
router.patch('/:patientId/archive', protect, PatientController.archivePatient);
router.patch('/:patientId/restore', protect, PatientController.restorePatient);

// Case management routes
router.post('/:patientId/cases', protect, PatientController.addCase);
router.get('/:patientId/cases/:caseId', protect, PatientController.getCaseById);
router.patch('/:patientId/cases/:caseId', protect, PatientController.updateCase);

// Note routes
router.post('/:patientId/cases/:caseId/notes', protect, PatientController.addNoteToCase);

// Image/X-ray upload routes
const upload = require('../middleware/upload');
router.post('/:patientId/cases/:caseId/images', protect, upload.array('images', 10), PatientController.uploadCaseImages);
router.delete('/:patientId/cases/:caseId/images/:imageId', protect, PatientController.deleteCaseImage);

module.exports = router;
