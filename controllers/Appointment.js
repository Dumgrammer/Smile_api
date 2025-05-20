const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');

// Create a new appointment
exports.createAppointment = async (req, res) => {
  try {
    const { patientId, date, startTime, endTime, title } = req.body;

    // Validate patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Check if slot is available
    const isAvailable = await Appointment.isSlotAvailable(date, startTime, endTime);
    if (!isAvailable) {
      return res.status(400).json({ 
        message: 'Time slot is not available. Maximum 2 patients per hour allowed.' 
      });
    }

    const appointment = new Appointment({
      patient: patientId,
      date,
      startTime,
      endTime,
      title
    });

    await appointment.save();
    res.status(201).json(appointment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all appointments
exports.getAppointments = async (req, res) => {
  try {
    const { date, status } = req.query;
    let query = { status: { $ne: 'Cancelled' } }; // Default filter to exclude cancelled

    if (date) {
      query.date = date;
    }
    if (status) {
      query.status = status;
    }

    const appointments = await Appointment.find(query)
      .populate('patient', 'firstName lastName middleName')
      .sort({ date: 1, startTime: 1 });

    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get archived (cancelled) appointments
exports.getArchivedAppointments = async (req, res) => {
  try {
    const { date } = req.query;
    let query = { status: 'Cancelled' };

    if (date) {
      query.date = date;
    }

    const appointments = await Appointment.find(query)
      .populate('patient', 'firstName lastName middleName')
      .sort({ date: -1, startTime: 1 })
      .limit(50); // Limit to 50 most recent cancelled appointments

    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get appointment by ID
exports.getAppointmentById = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient', 'firstName lastName middleName');
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update appointment
exports.updateAppointment = async (req, res) => {
  try {
    const { date, startTime, endTime, status, title } = req.body;
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // If changing time slot, check availability
    if (date && startTime && endTime) {
      const isAvailable = await appointment.canBeRescheduled(date, startTime, endTime);
      if (!isAvailable) {
        return res.status(400).json({ 
          message: 'New time slot is not available' 
        });
      }
    }

    // Update fields
    if (date) appointment.date = date;
    if (startTime) appointment.startTime = startTime;
    if (endTime) appointment.endTime = endTime;
    if (status) appointment.status = status;
    if (title !== undefined) appointment.title = title;

    await appointment.save();
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete appointment
exports.deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Instead of deleting, mark as cancelled
    appointment.status = 'Cancelled';
    await appointment.save();

    res.json({ message: 'Appointment cancelled successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get available time slots for a specific date
exports.getAvailableSlots = async (req, res) => {
  try {
    const { date } = req.params;
    const businessHours = {
      start: '08:00',
      end: '17:00'
    };

    // Get all appointments for the date
    const appointments = await Appointment.find({
      date,
      status: { $ne: 'Cancelled' }
    }).sort({ startTime: 1 });

    // Generate all possible slots
    const slots = [];
    let currentTime = businessHours.start;

    while (currentTime < businessHours.end) {
      const [hours, minutes] = currentTime.split(':').map(Number);
      const endTime = `${hours + 1}:${minutes.toString().padStart(2, '0')}`;

      // Count appointments in this slot
      const appointmentsInSlot = appointments.filter(apt => 
        apt.startTime <= endTime && apt.endTime > currentTime
      ).length;

      slots.push({
        startTime: currentTime,
        endTime,
        available: appointmentsInSlot < 2
      });

      // Move to next hour
      currentTime = endTime;
    }

    res.json(slots);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get appointments for a specific patient
exports.getPatientAppointments = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { sortBy = 'date' } = req.query;

    // Validate patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    let sortOptions = {};
    switch (sortBy) {
      case 'date':
        sortOptions = { date: -1, startTime: -1 };
        break;
      case 'dateAsc':
        sortOptions = { date: 1, startTime: 1 };
        break;
      case 'status':
        sortOptions = { status: 1, date: -1 };
        break;
      default:
        sortOptions = { date: -1, startTime: -1 };
    }

    const appointments = await Appointment.find({ patient: patientId })
      .sort(sortOptions);

    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
