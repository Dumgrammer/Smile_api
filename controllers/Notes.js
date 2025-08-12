const Notes = require('../models/Notes');
const Appointment = require('../models/Appointment');
const { encrypt, decrypt } = require('../utils/crypto');

// Create notes for an appointment
exports.createNotes = async (req, res) => {
  try {
    console.log('Creating notes - Request body:', req.body);
    const decryptedData = decrypt(req.body.data);
    console.log('Decrypted data:', decryptedData);
    const { appointmentId, patientId, treatmentNotes, reminderNotes, payment } = decryptedData;

    // Validate appointment exists
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    // Allow notes for appointments that are not cancelled or pending
    if (appointment.status === 'Cancelled' || appointment.status === 'Pending') {
      return res.status(400).json({ message: 'Cannot add notes to a cancelled or pending appointment' });
    }


    const notes = new Notes({
      appointment: appointmentId,
      patient: patientId,
      treatmentNotes,
      reminderNotes,
      payment: {
        status: payment.status
      },
      createdBy: req.admin._id
    });

    await notes.save();
    console.log('Notes saved successfully:', notes);
    res.status(201).json({ data: encrypt(notes) });
  } catch (error) {
    console.error('Error creating notes:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get notes for an appointment
exports.getNotesByAppointment = async (req, res) => {
  try {
    const notes = await Notes.findOne({ appointment: req.params.appointmentId })
      .populate('patient', 'firstName lastName')
      .populate('createdBy', 'firstName lastName');

    if (!notes) {
      return res.status(404).json({ message: 'Notes not found' });
    }

    res.json({ data: encrypt(notes) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update notes
exports.updateNotes = async (req, res) => {
  try {
    const decryptedData = decrypt(req.body.data);
    const { treatmentNotes, payment } = decryptedData;
    const notes = await Notes.findOne({ appointment: req.params.appointmentId });

    if (!notes) {
      return res.status(404).json({ message: 'Notes not found' });
    }

    if (treatmentNotes) notes.treatmentNotes = treatmentNotes;
    if (payment) notes.payment = payment;

    await notes.save();
    res.json({ data: encrypt(notes) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all notes for a patient
exports.getPatientNotes = async (req, res) => {
  try {
    const notes = await Notes.find({ patient: req.params.patientId })
      .populate('appointment', 'date startTime endTime title')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({ data: encrypt(notes) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; 