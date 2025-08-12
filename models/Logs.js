const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: false // Allow null for public actions
  },
  adminName: {
    type: String,
    required: [true, 'Admin name is required'],
    trim: true,
    default: 'Public User'
  },
  action: {
    type: String,
    required: [true, 'Action is required'],
    trim: true,
    enum: [
      // Inquiry actions
      'INQUIRY_STATUS_UPDATED',
      'INQUIRY_ARCHIVED',
      'INQUIRY_RESTORED',
      'INQUIRY_DELETED',
      'INQUIRY_REPLIED',
      // Appointment actions
      'APPOINTMENT_CREATED',
      'APPOINTMENT_UPDATED',
      'APPOINTMENT_DELETED',
      'APPOINTMENT_STATUS_CHANGED',
      'APPOINTMENT_COMPLETED',
      'APPOINTMENT_CANCELLED',
      'APPOINTMENT_RESCHEDULED',
      'APPOINTMENT_APPROVED',
      'APPOINTMENT_REQUESTED',
      // Patient actions
      'PATIENT_CREATED',
      'PATIENT_UPDATED',
      'PATIENT_DELETED',
      'PATIENT_DEACTIVATED',
      'PATIENT_ARCHIVED',
      'PATIENT_RESTORED',
      'PATIENT_HARD_DELETED',
      'PATIENTS_BULK_ARCHIVED',
      'PATIENTS_BULK_RESTORED',
      // General actions
      'LOGIN',
      'LOGOUT',
      'PASSWORD_CHANGED'
    ]
  },
  entityType: {
    type: String,
    required: [true, 'Entity type is required'],
    enum: ['inquiry', 'appointment', 'patient', 'admin', 'system']
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: function() {
      return this.entityType !== 'system';
    }
  },
  entityName: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for formatted creation date
logSchema.virtual('formattedCreatedAt').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Index for efficient queries
logSchema.index({ adminId: 1 });
logSchema.index({ action: 1 });
logSchema.index({ entityType: 1 });
logSchema.index({ entityId: 1 });
logSchema.index({ createdAt: -1 });
logSchema.index({ adminId: 1, createdAt: -1 });

// Static method to get log statistics
logSchema.statics.getStats = async function(adminId = null) {
  const filter = adminId ? { adminId } : {};
  
  const stats = await this.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$action',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const totalLogs = await this.countDocuments(filter);
  const todayLogs = await this.countDocuments({
    ...filter,
    createdAt: { 
      $gte: new Date(new Date().setHours(0, 0, 0, 0)) 
    }
  });

  return {
    total: totalLogs,
    today: todayLogs,
    byAction: stats
  };
};

// Static method to create a log entry
logSchema.statics.createLog = async function(logData) {
  try {
    const log = new this(logData);
    await log.save();
    return log;
  } catch (error) {
    console.error('Error creating log:', error);
    throw error;
  }
};

// Static method to get logs with pagination
logSchema.statics.getLogsPaginated = async function(options = {}) {
  const {
    page = 1,
    limit = 20,
    adminId,
    action,
    entityType,
    startDate,
    endDate
  } = options;

  // Build filter
  const filter = {};
  if (adminId) filter.adminId = adminId;
  if (action) filter.action = action;
  if (entityType) filter.entityType = entityType;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const logs = await this.find(filter)
    .populate('adminId', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

  const total = await this.countDocuments(filter);

  return {
    logs,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    total
  };
};

module.exports = mongoose.model('Log', logSchema);
