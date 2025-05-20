const mongoose = require('mongoose');

// Case schema for patient's dental cases
const caseSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    treatmentPlan: {
        type: String,
        required: false
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: false
    },
    status: {
        type: String,
        enum: ['Active', 'Completed', 'Cancelled'],
        default: 'Active'
    },
    notes: [{
        content: String,
        date: {
            type: Date,
            default: Date.now
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin'
        }
    }]
}, { timestamps: true });

// Main Patient schema
const patientSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    middleName: {
        type: String,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    birthDate: {
        type: Date,
        required: true
    },
    age: {
        type: Number,
        required: true,
        min: 0
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other'],
        required: true
    },
    contactNumber: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address.']
    },
    address: {
        street: String,
        city: String,
        province: String,
        postalCode: String
    },
    emergencyContact: {
        name: String,
        relationship: String,
        contactNumber: String
    },
    // Simplified medical history with only allergies field
    allergies: {
        type: String,
        trim: true
    },
    cases: [caseSchema],
    registrationDate: {
        type: Date,
        default: Date.now
    },
    lastVisit: {
        type: Date
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Virtual for patient's full name
patientSchema.virtual('fullName').get(function() {
    if (this.middleName) {
        return `${this.firstName} ${this.middleName} ${this.lastName}`;
    }
    return `${this.firstName} ${this.lastName}`;
});

// Method to calculate age based on birthdate
patientSchema.methods.calculateAge = function() {
    const today = new Date();
    const birthDate = new Date(this.birthDate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    return age;
};

// Pre-save hook to update age before saving
patientSchema.pre('save', function(next) {
    this.age = this.calculateAge();
    next();
});

module.exports = mongoose.model('Patient', patientSchema);
