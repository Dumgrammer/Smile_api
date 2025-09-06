const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        // Validate time format (HH:mm)
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: props => `${props.value} is not a valid time format! Use HH:mm format.`
    }
  },
  endTime: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        // Validate time format (HH:mm)
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: props => `${props.value} is not a valid time format! Use HH:mm format.`
    }
  },
  status: {
    type: String,
    enum: ['Scheduled', 'Finished', 'Rescheduled', 'Cancelled', 'Pending'],
    default: 'Scheduled'
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  cancellationReason: {
    type: String,
    trim: true,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient querying of appointments by date and time
appointmentSchema.index({ date: 1, startTime: 1, endTime: 1 });

// Static method to check slot availability
appointmentSchema.statics.isSlotAvailable = async function(date, startTime, endTime) {
  // Check if the time slot is valid (end time should be after start time)
  if (endTime <= startTime) {
    return false;
  }

  // Check if the appointment is within business hours (9 AM to 5 PM)
  const startHour = parseInt(startTime.split(':')[0]);
  const endHour = parseInt(endTime.split(':')[0]);
  if (startHour < 9 || endHour > 17) {
    return false;
  }

  // Convert date string to Date object if needed
  const appointmentDate = typeof date === 'string' ? new Date(date) : date;
  
  // Count existing appointments in the same time slot
  const existingAppointments = await this.countDocuments({
    date: appointmentDate,
    status: { $ne: 'Cancelled' }, // Don't count cancelled appointments
    $or: [
      // Check if new appointment overlaps with existing ones
      {
        $and: [
          { startTime: { $lte: startTime } },
          { endTime: { $gt: startTime } }
        ]
      },
      {
        $and: [
          { startTime: { $lt: endTime } },
          { endTime: { $gte: endTime } }
        ]
      }
    ]
  });

  // Allow maximum 2 patients per hour
  return existingAppointments < 2;
};

// Static method to check slot availability for rescheduling (excludes current appointment)
appointmentSchema.statics.isSlotAvailableForReschedule = async function(date, startTime, endTime, excludeAppointmentId) {
  // Check if the time slot is valid (end time should be after start time)
  if (endTime <= startTime) {
    return false;
  }

  // Check if the appointment is within business hours (9 AM to 5 PM)
  const startHour = parseInt(startTime.split(':')[0]);
  const endHour = parseInt(endTime.split(':')[0]);
  if (startHour < 9 || endHour > 17) {
    return false;
  }

  // Convert date string to Date object if needed
  const appointmentDate = typeof date === 'string' ? new Date(date) : date;
  
  // Count existing appointments in the same time slot, excluding the current appointment
  const existingAppointments = await this.countDocuments({
    _id: { $ne: excludeAppointmentId }, // Exclude the current appointment
    date: appointmentDate,
    status: { $ne: 'Cancelled' }, // Don't count cancelled appointments
    $or: [
      // Check if new appointment overlaps with existing ones
      {
        $and: [
          { startTime: { $lte: startTime } },
          { endTime: { $gt: startTime } }
        ]
      },
      {
        $and: [
          { startTime: { $lt: endTime } },
          { endTime: { $gte: endTime } }
        ]
      }
    ]
  });

  // Allow maximum 2 patients per hour
  return existingAppointments < 2;
};

// Method to check if appointment can be rescheduled
appointmentSchema.methods.canBeRescheduled = async function(newDate, newStartTime, newEndTime) {
  try {
    // Don't allow rescheduling if cancelled
    if (this.status === 'Cancelled') {
      return false;
    }

    // Check if new slot is available, excluding this appointment
    const isSlotAvailable = await this.constructor.isSlotAvailableForReschedule(newDate, newStartTime, newEndTime, this._id);
    
    // If slot is available, allow rescheduling (including finished appointments for follow-ups)
    return isSlotAvailable;
  } catch (error) {
    console.error('Error in canBeRescheduled:', error);
    return false;
  }
};

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
