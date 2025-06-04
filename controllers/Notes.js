const Notes = require('../models/Notes');
const Appointment = require('../models/Appointment');

// Create notes for an appointment
exports.createNotes = async (req, res) => {
  try {
    const { appointmentId, patientId, treatmentNotes, reminderNotes, payment } = req.body;

    // Validate appointment exists and is completed
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    if (appointment.status !== 'Finished') {
      return res.status(400).json({ message: 'Cannot add notes to an incomplete appointment' });
    }

    // Validate payment amount
    if (!payment || typeof payment.amount !== 'number' || payment.amount < 0) {
      return res.status(400).json({ message: 'Invalid payment amount' });
    }

    const notes = new Notes({
      appointment: appointmentId,
      patient: patientId,
      treatmentNotes,
      reminderNotes,
      payment: {
        amount: payment.amount,
        status: payment.status
      },
      createdBy: req.admin._id
    });

    await notes.save();
    res.status(201).json(notes);
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

    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update notes
exports.updateNotes = async (req, res) => {
  try {
    const { treatmentNotes, payment } = req.body;
    const notes = await Notes.findOne({ appointment: req.params.appointmentId });

    if (!notes) {
      return res.status(404).json({ message: 'Notes not found' });
    }

    if (treatmentNotes) notes.treatmentNotes = treatmentNotes;
    if (payment) notes.payment = payment;

    await notes.save();
    res.json(notes);
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

    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; 