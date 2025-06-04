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
    enum: ['Scheduled', 'Finished', 'Rescheduled', 'Cancelled'],
    default: 'Scheduled'
  },
  title: {
    type: String,
    required: true,
    trim: true
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

  // Check if the appointment is within business hours (9 AM to 7 PM)
  const startHour = parseInt(startTime.split(':')[0]);
  const endHour = parseInt(endTime.split(':')[0]);
  if (startHour < 9 || endHour > 19) {
    return false;
  }

  // Count existing appointments in the same time slot
  const existingAppointments = await this.countDocuments({
    date: date,
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
  // Don't allow rescheduling if already finished or cancelled
  if (this.status === 'Finished' || this.status === 'Cancelled') {
    return false;
  }

  // Check if new slot is available
  return await this.constructor.isSlotAvailable(newDate, newStartTime, newEndTime);
};

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
