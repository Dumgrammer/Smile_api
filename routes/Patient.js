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
router.get('/:patientId', protect, PatientController.getPatientById);
router.patch('/:patientId', protect, PatientController.updatePatient);
router.delete('/:patientId', protect, PatientController.deletePatient);
router.delete('/:patientId/permanent', protect, PatientController.hardDeletePatient);

// Case management routes
router.post('/:patientId/cases', protect, PatientController.addCase);
router.get('/:patientId/cases/:caseId', protect, PatientController.getCaseById);
router.patch('/:patientId/cases/:caseId', protect, PatientController.updateCase);

// Note routes
router.post('/:patientId/cases/:caseId/notes', protect, PatientController.addNoteToCase);

module.exports = router;
