const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/Appointment');
const { protect } = require('../middleware/auth');

// Create a new appointment (protected - for admin use)
router.post('/', protect, appointmentController.createAppointment);

// Create a new appointment (public - for online booking with Pending status)
router.post('/public', appointmentController.createPublicAppointment);

// Get all appointments (with optional date and status filters)
router.get('/', protect, appointmentController.getAppointments);

// Get archived appointments (must come before /:id route)
router.get('/archived', protect, appointmentController.getArchivedAppointments);

// Get missed appointments
router.get('/missed', protect, appointmentController.getMissedAppointments);

// Update missed appointments (mark as cancelled)
router.put('/missed/update', protect, appointmentController.updateMissedAppointments);

// Get available time slots for a specific date
router.get('/slots/:date', appointmentController.getAvailableSlots);

// Reschedule appointment
router.put('/:id/reschedule', protect, appointmentController.rescheduleAppointment);

// Get appointment by ID
router.get('/:id', protect, appointmentController.getAppointmentById);

// Update appointment
router.put('/:id', protect, appointmentController.updateAppointment);

// Cancel appointment with reason
router.put('/:id/cancel', protect, appointmentController.cancelAppointmentWithReason);

// Delete (cancel) appointment
router.delete('/:id', protect, appointmentController.deleteAppointment);

// Get appointments for a specific patient
router.get('/patient/:patientId', protect, appointmentController.getPatientAppointments);

// Get appointments for a specific patient (public endpoint for online booking)
router.get('/patient/:patientId/public', appointmentController.getPatientAppointmentsPublic);

module.exports = router;
