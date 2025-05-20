const mongoose = require('mongoose');
const Patient = require('../models/Patient');

// Create a new patient
exports.createPatient = async (req, res) => {
    try {
        const {
            firstName,
            middleName,
            lastName,
            birthDate,
            gender,
            contactNumber,
            email,
            address,
            emergencyContact,
            allergies,
            cases
        } = req.body;

        // Calculate initial age
        const birthDateObj = new Date(birthDate);
        const today = new Date();
        let age = today.getFullYear() - birthDateObj.getFullYear();
        const monthDiff = today.getMonth() - birthDateObj.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
            age--;
        }

        const patient = new Patient({
            firstName,
            middleName,
            lastName,
            birthDate,
            age,
            gender,
            contactNumber,
            email,
            address,
            emergencyContact,
            allergies,
            cases
        });

        const savedPatient = await patient.save();
        res.status(201).json({
            message: 'Patient created successfully',
            patient: savedPatient
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Patient creation failed',
            details: error.message
        });
    }
};

// Get all patients with pagination
exports.getAllPatients = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';

        let query = {};
        if (search) {
            query = {
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } },
                    { contactNumber: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const totalPatients = await Patient.countDocuments(query);
        const patients = await Patient.find(query)
            .skip(skip)
            .limit(limit)
            .select('firstName middleName lastName age gender contactNumber email lastVisit isActive')
            .sort({ createdAt: -1 });

        res.status(200).json({
            message: 'Patients retrieved successfully',
            totalPatients,
            totalPages: Math.ceil(totalPatients / limit),
            currentPage: page,
            patients
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Failed to retrieve patients',
            details: error.message
        });
    }
};

// Get patient by ID
exports.getPatientById = async (req, res) => {
    try {
        const id = req.params.patientId;
        const patient = await Patient.findById(id);
        
        if (!patient) {
            return res.status(404).json({
                message: 'Patient not found'
            });
        }
        
        res.status(200).json({
            patient
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Failed to retrieve patient',
            details: error.message
        });
    }
};

// Update patient information
exports.updatePatient = async (req, res) => {
    try {
        const id = req.params.patientId;
        const updates = req.body;
        
        // Check if birthdate is being updated to recalculate age
        if (updates.birthDate) {
            const birthDateObj = new Date(updates.birthDate);
            const today = new Date();
            let age = today.getFullYear() - birthDateObj.getFullYear();
            const monthDiff = today.getMonth() - birthDateObj.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
                age--;
            }
            updates.age = age;
        }
        
        const updatedPatient = await Patient.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );
        
        if (!updatedPatient) {
            return res.status(404).json({
                message: 'Patient not found'
            });
        }
        
        res.status(200).json({
            message: 'Patient updated successfully',
            patient: updatedPatient
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Failed to update patient',
            details: error.message
        });
    }
};

// Delete patient (soft delete)
exports.deletePatient = async (req, res) => {
    try {
        const id = req.params.patientId;
        
        const patient = await Patient.findByIdAndUpdate(
            id,
            { $set: { isActive: false } },
            { new: true }
        );
        
        if (!patient) {
            return res.status(404).json({
                message: 'Patient not found'
            });
        }
        
        res.status(200).json({
            message: 'Patient deactivated successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Failed to deactivate patient',
            details: error.message
        });
    }
};

// Hard delete patient (for admin use only)
exports.hardDeletePatient = async (req, res) => {
    try {
        const id = req.params.patientId;
        
        const result = await Patient.findByIdAndDelete(id);
        
        if (!result) {
            return res.status(404).json({
                message: 'Patient not found'
            });
        }
        
        res.status(200).json({
            message: 'Patient permanently deleted'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Failed to delete patient',
            details: error.message
        });
    }
};

// Add a new case to a patient
exports.addCase = async (req, res) => {
    try {
        const patientId = req.params.patientId;
        const caseData = req.body;
        
        const patient = await Patient.findById(patientId);
        
        if (!patient) {
            return res.status(404).json({
                message: 'Patient not found'
            });
        }
        
        patient.cases.push(caseData);
        patient.lastVisit = new Date();
        
        const updatedPatient = await patient.save();
        
        res.status(201).json({
            message: 'Case added successfully',
            patient: updatedPatient,
            newCase: updatedPatient.cases[updatedPatient.cases.length - 1]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Failed to add case',
            details: error.message
        });
    }
};

// Get case by ID
exports.getCaseById = async (req, res) => {
    try {
        const patientId = req.params.patientId;
        const caseId = req.params.caseId;
        
        const patient = await Patient.findById(patientId);
        
        if (!patient) {
            return res.status(404).json({
                message: 'Patient not found'
            });
        }
        
        const patientCase = patient.cases.id(caseId);
        
        if (!patientCase) {
            return res.status(404).json({
                message: 'Case not found'
            });
        }
        
        res.status(200).json({
            case: patientCase
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Failed to retrieve case',
            details: error.message
        });
    }
};

// Update case
exports.updateCase = async (req, res) => {
    try {
        const patientId = req.params.patientId;
        const caseId = req.params.caseId;
        const updates = req.body;
        
        const patient = await Patient.findById(patientId);
        
        if (!patient) {
            return res.status(404).json({
                message: 'Patient not found'
            });
        }
        
        const patientCase = patient.cases.id(caseId);
        
        if (!patientCase) {
            return res.status(404).json({
                message: 'Case not found'
            });
        }
        
        // Update the fields
        Object.keys(updates).forEach(key => {
            patientCase[key] = updates[key];
        });
        
        patient.lastVisit = new Date();
        const updatedPatient = await patient.save();
        
        res.status(200).json({
            message: 'Case updated successfully',
            case: updatedPatient.cases.id(caseId)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Failed to update case',
            details: error.message
        });
    }
};

// Add note to case
exports.addNoteToCase = async (req, res) => {
    try {
        const patientId = req.params.patientId;
        const caseId = req.params.caseId;
        const { content, createdBy } = req.body;
        
        const patient = await Patient.findById(patientId);
        
        if (!patient) {
            return res.status(404).json({
                message: 'Patient not found'
            });
        }
        
        const patientCase = patient.cases.id(caseId);
        
        if (!patientCase) {
            return res.status(404).json({
                message: 'Case not found'
            });
        }
        
        patientCase.notes.push({
            content,
            date: new Date(),
            createdBy
        });
        
        patient.lastVisit = new Date();
        const updatedPatient = await patient.save();
        
        res.status(201).json({
            message: 'Note added successfully',
            notes: updatedPatient.cases.id(caseId).notes
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Failed to add note',
            details: error.message
        });
    }
};

// Add payment to case
exports.addPaymentToCase = async (req, res) => {
    try {
        const patientId = req.params.patientId;
        const caseId = req.params.caseId;
        const { amount, method, notes } = req.body;
        
        const patient = await Patient.findById(patientId);
        
        if (!patient) {
            return res.status(404).json({
                message: 'Patient not found'
            });
        }
        
        const patientCase = patient.cases.id(caseId);
        
        if (!patientCase) {
            return res.status(404).json({
                message: 'Case not found'
            });
        }
        
        patientCase.payments.push({
            amount,
            date: new Date(),
            method,
            notes
        });
        
        patient.lastVisit = new Date();
        const updatedPatient = await patient.save();
        
        res.status(201).json({
            message: 'Payment added successfully',
            payments: updatedPatient.cases.id(caseId).payments
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Failed to add payment',
            details: error.message
        });
    }
};
