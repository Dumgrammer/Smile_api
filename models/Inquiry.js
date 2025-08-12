const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [100, 'Full name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  status: {
    type: String,
    enum: ['Unread', 'Read', 'Replied'],
    default: 'Unread'
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  archiveReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Archive reason cannot exceed 500 characters']
  },
  archivedAt: {
    type: Date
  },
  archivedBy: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for formatted creation date
inquirySchema.virtual('formattedCreatedAt').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Index for efficient queries
inquirySchema.index({ email: 1 });
inquirySchema.index({ status: 1 });
inquirySchema.index({ createdAt: -1 });

// Static method to get inquiry statistics
inquirySchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const totalInquiries = await this.countDocuments();
  const unreadInquiries = await this.countDocuments({ status: 'Unread' });

  return {
    total: totalInquiries,
    unread: unreadInquiries,
    byStatus: stats
  };
};

// Instance method to mark as read
inquirySchema.methods.markAsRead = function() {
  if (this.status === 'Unread') {
    this.status = 'Read';
    return this.save();
  }
  return Promise.resolve(this);
};

// Instance method to mark as replied
inquirySchema.methods.markAsReplied = function() {
  this.status = 'Replied';
  return this.save();
};

// Instance method to archive inquiry
inquirySchema.methods.archive = function(reason, archivedBy) {
  this.isArchived = true;
  this.archiveReason = reason;
  this.archivedAt = new Date();
  this.archivedBy = archivedBy;
  return this.save();
};

// Instance method to unarchive inquiry
inquirySchema.methods.unarchive = function() {
  this.isArchived = false;
  this.archiveReason = null;
  this.archivedAt = null;
  this.archivedBy = null;
  return this.save();
};

module.exports = mongoose.model('Inquiry', inquirySchema);
