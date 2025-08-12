const mongoose = require('mongoose');

const notesSchema = new mongoose.Schema({
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  treatmentNotes: {
    type: String,
    required: true,
    trim: true
  },
  reminderNotes: {
    type: String,
    trim: true
  },
  payment: {
    amount: {
      type: Number,
      required: false,
      min: 0,
      default: 0
    },
    status: {
      type: String,
      enum: ['Paid', 'Pending', 'Partial'],
      required: true
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
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

// Index for efficient querying
notesSchema.index({ appointment: 1 });
notesSchema.index({ patient: 1 });

const Notes = mongoose.model('Notes', notesSchema);

module.exports = Notes;
