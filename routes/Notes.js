const express = require('express');
const router = express.Router();
const notesController = require('../controllers/Notes');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Create notes for an appointment
router.post('/', notesController.createNotes);

// Get notes for an appointment
router.get('/appointment/:appointmentId', notesController.getNotesByAppointment);

// Update notes
router.put('/appointment/:appointmentId', notesController.updateNotes);

// Get all notes for a patient
router.get('/patient/:patientId', notesController.getPatientNotes);

module.exports = router; 