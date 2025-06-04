const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/Appointment');

// Create a new appointment
router.post('/', appointmentController.createAppointment);

// Get all appointments (with optional date and status filters)
router.get('/', appointmentController.getAppointments);

// Get archived appointments (must come before /:id route)
router.get('/archived', appointmentController.getArchivedAppointments);

// Get available time slots for a specific date
router.get('/slots/:date', appointmentController.getAvailableSlots);

// Reschedule appointment
router.put('/:id/reschedule', appointmentController.rescheduleAppointment);

// Get appointment by ID
router.get('/:id', appointmentController.getAppointmentById);

// Update appointment
router.put('/:id', appointmentController.updateAppointment);

// Delete (cancel) appointment
router.delete('/:id', appointmentController.deleteAppointment);

// Get appointments for a specific patient
router.get('/patient/:patientId', appointmentController.getPatientAppointments);

module.exports = router;
