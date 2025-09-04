const mongoose = require('mongoose');
const Patient = require('../models/Patient');
const nodemailer = require('nodemailer');
const { encrypt, decrypt } = require('../utils/crypto');
const { logAction } = require('./Logs');

// Configure nodemailer with Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.APP_EMAIL,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Store verification codes temporarily (in production, use Redis or database)
const verificationCodes = new Map();

// Generate a random 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send verification code email
const sendVerificationEmail = async (patient, verificationCode) => {
  // Validate required patient data
  if (!patient || !patient.email || !patient.firstName || !patient.lastName) {
    console.error('Invalid patient data for verification email:', {
      hasPatient: !!patient,
      hasEmail: !!(patient && patient.email),
      hasFirstName: !!(patient && patient.firstName),
      hasLastName: !!(patient && patient.lastName)
    });
    return false;
  }
  const emailStyles = `
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      .header {
        background: linear-gradient(to right, #7c3aed, #6d28d9);
        color: white;
        padding: 30px;
        text-align: center;
        border-radius: 10px 10px 0 0;
      }
      .content {
        background: white;
        padding: 30px;
        border: 1px solid #e5e7eb;
        border-radius: 0 0 10px 10px;
      }
      .verification-code {
        background: #f9fafb;
        padding: 30px;
        border-radius: 8px;
        margin: 20px 0;
        text-align: center;
        border: 2px dashed #7c3aed;
      }
      .code {
        font-size: 48px;
        font-weight: bold;
        color: #7c3aed;
        letter-spacing: 8px;
        margin: 20px 0;
        font-family: 'Courier New', monospace;
      }
      .detail-item {
        margin: 10px 0;
        display: flex;
        align-items: center;
      }
      .detail-item strong {
        width: 120px;
        color: #4b5563;
      }
      .footer {
        text-align: center;
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid #e5e7eb;
        color: #6b7280;
      }
      .logo {
        font-size: 24px;
        font-weight: bold;
        margin-bottom: 10px;
      }
      .warning {
        background: #fef3c7;
        padding: 15px;
        border-radius: 8px;
        margin: 20px 0;
        border-left: 4px solid #f59e0b;
        color: #92400e;
      }
    </style>
  `;

  const mailOptions = {
    from: `"MA Florencio Dental Clinic" <${process.env.APP_EMAIL}>`,
    to: patient.email,
    subject: 'Verification Code - MA Florencio Dental Clinic',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        ${emailStyles}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">MA Florencio Dental Clinic</div>
            <h1>Verification Code</h1>
          </div>
          <div class="content">
            <p>Dear ${patient.firstName} ${patient.lastName},</p>
            <p>We found your patient record. To proceed with your appointment booking, please use the verification code below:</p>
            
            <div class="verification-code">
              <h2 style="color: #7c3aed; margin-top: 0;">Your Verification Code</h2>
              <div class="code">${verificationCode}</div>
              <p style="margin: 0; color: #6b7280;">Enter this code to verify your identity</p>
            </div>

            <div class="warning">
              <strong>Important:</strong> This code will expire in 10 minutes for security reasons.
            </div>

            <div class="detail-item">
              <strong>Patient Name:</strong>
              <span>${patient.firstName} ${patient.middleName ? patient.middleName + ' ' : ''}${patient.lastName}</span>
            </div>
            <div class="detail-item">
              <strong>Email:</strong>
              <span>${patient.email}</span>
            </div>
            ${patient.contactNumber ? `<div class="detail-item">
              <strong>Contact:</strong>
              <span>${patient.contactNumber}</span>
            </div>` : ''}

            <p>If you did not request this verification code, please ignore this email.</p>
            
            <div class="footer">
              <p>Best regards,<br>The MA Florencio Dental Clinic Team</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    console.log('Starting verification email process for:', patient.email);
    
    // Verify transporter configuration before sending
    console.log('Verifying transporter...');
    await transporter.verify();
    console.log('Transporter verified successfully for verification email');
    
    console.log('Sending email with options:', {
      to: mailOptions.to,
      subject: mailOptions.subject,
      from: mailOptions.from
    });
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending verification email to:', patient.email);
    console.error('Error details:', error.message);
    console.error('Full error:', error);
    return false;
  }
};

// Create a new patient
exports.createPatient = async (req, res) => {
    try {
        // Decrypt the incoming data
        const decryptedData = decrypt(req.body.data);
        
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
        } = decryptedData;

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
        
        // Log the action
        await logAction(
            req.admin._id,
            `${req.admin.firstName} ${req.admin.lastName}`,
            'PATIENT_CREATED',
            'patient',
            savedPatient._id,
            `${savedPatient.firstName} ${savedPatient.lastName}`,
            `Created new patient: ${savedPatient.firstName} ${savedPatient.middleName ? savedPatient.middleName + ' ' : ''}${savedPatient.lastName}`,
            {
                patientId: savedPatient._id,
                contactNumber: savedPatient.contactNumber,
                email: savedPatient.email,
                age: savedPatient.age,
                gender: savedPatient.gender,
                casesCount: savedPatient.cases ? savedPatient.cases.length : 0
            }
        );
        
        // Encrypt the entire response
        const encryptedResponse = encrypt({
            message: 'Patient created successfully',
            patient: savedPatient.toObject()
        });
        
        res.status(201).json({
            data: encryptedResponse
        });
    } catch (error) {
        console.error(error);
        
        // Encrypt error response
        const encryptedError = encrypt({
            error: 'Patient creation failed',
            details: error.message
        });
        
        res.status(500).json({
            data: encryptedError
        });
    }
};

// Get all patients with pagination
exports.getAllPatients = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const includeArchived = req.query.includeArchived === 'true';
        const skip = (page - 1) * limit;

        // Build query based on archive filter
        let query = {};
        if (includeArchived) {
            // When includeArchived is true, show ONLY archived patients
            query.isActive = false;
        } else {
            // When includeArchived is false, show ONLY active patients
            query.isActive = true;
        }

        const totalPatients = await Patient.countDocuments(query);
        const patients = await Patient.find(query)
            .skip(skip)
            .limit(limit)
            .select('firstName middleName lastName age gender contactNumber email lastVisit isActive cases')
            .sort({ createdAt: -1 });

        // Encrypt the entire response
        const encryptedResponse = encrypt({
            message: 'Patients retrieved successfully',
            totalPatients,
            totalPages: Math.ceil(totalPatients / limit),
            currentPage: page,
            patients: patients.map(patient => patient.toObject()),
            includeArchived
        });

        res.status(200).json({
            data: encryptedResponse
        });
    } catch (error) {
        console.error(error);
        
        // Encrypt error response
        const encryptedError = encrypt({
            error: 'Failed to retrieve patients',
            details: error.message
        });
        
        res.status(500).json({
            data: encryptedError
        });
    }
};

// Search patients using POST with request body
exports.searchPatients = async (req, res) => {
    try {
        // Decrypt the incoming data
        const decryptedData = decrypt(req.body.data);
        
        const {
            search,
            page = 1,
            limit = 10,
            filters = {}
        } = decryptedData;

        console.log('Search patients called with:', {
            search,
            page,
            limit,
            filters,
            decryptedData
        });

        const skip = (page - 1) * limit;

        let query = {};

        // Add search functionality
        if (search && search.trim()) {
            query.$or = [
                { firstName: { $regex: search.trim(), $options: 'i' } },
                { lastName: { $regex: search.trim(), $options: 'i' } },
                { contactNumber: { $regex: search.trim(), $options: 'i' } },
                { email: { $regex: search.trim(), $options: 'i' } }
            ];
        }

        // Add additional filters
        if (filters.gender) {
            query.gender = filters.gender;
        }
        if (filters.ageRange) {
            if (filters.ageRange.min !== undefined) {
                query.age = { ...query.age, $gte: filters.ageRange.min };
            }
            if (filters.ageRange.max !== undefined) {
                query.age = { ...query.age, $lte: filters.ageRange.max };
            }
        }
        // Handle isActive filter for archive toggle
        if (filters.isActive !== undefined) {
            query.isActive = filters.isActive;
        }
        if (filters.lastVisit) {
            if (filters.lastVisit.from) {
                query.lastVisit = { ...query.lastVisit, $gte: new Date(filters.lastVisit.from) };
            }
            if (filters.lastVisit.to) {
                query.lastVisit = { ...query.lastVisit, $lte: new Date(filters.lastVisit.to) };
            }
        }

        const totalPatients = await Patient.countDocuments(query);
        const patients = await Patient.find(query)
            .skip(skip)
            .limit(limit)
            .select('firstName middleName lastName age gender contactNumber email lastVisit isActive address emergencyContact cases')
            .sort({ createdAt: -1 });

        // If this is a single patient search (likely for appointment booking), send verification code
        console.log('Checking verification email conditions:', {
            hasSearch: !!search,
            searchValue: search,
            patientsLength: patients.length,
            firstPatientEmail: patients[0] ? patients[0].email : 'NO_PATIENT_FOUND',
            condition: search && patients.length === 1 && patients[0].email
        });
        
        if (search && patients.length === 1 && patients[0].email) {
            const patient = patients[0].toObject();
            const verificationCode = generateVerificationCode();
            
            // Store the verification code with patient ID and expiration (10 minutes)
            verificationCodes.set(patient._id.toString(), {
                code: verificationCode,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
            });
            
            // Send verification email
            console.log('Attempting to send verification email to:', patient.email);
            console.log('Patient data for email:', {
                firstName: patient.firstName,
                lastName: patient.lastName,
                email: patient.email,
                contactNumber: patient.contactNumber,
                hasMiddleName: !!patient.middleName
            });
            const emailSent = await sendVerificationEmail(patient, verificationCode);
            console.log('Email sending result:', emailSent);
            
            if (emailSent) {
                const encryptedResponse = encrypt({
                    message: 'Patient found and verification code sent',
                    totalPatients: 1,
                    totalPages: 1,
                    currentPage: 1,
                    patients: [patient],
                    verificationCodeSent: true,
                    message: 'Verification code has been sent to your email address.'
                });
                
                res.status(200).json({
                    data: encryptedResponse
                });
            } else {
                const encryptedResponse = encrypt({
                    message: 'Patient found but failed to send verification code',
                    totalPatients: 1,
                    totalPages: 1,
                    currentPage: 1,
                    patients: [patient],
                    verificationCodeSent: false,
                    message: 'Patient found but there was an issue sending the verification code. Please try again.'
                });
                
                res.status(200).json({
                    data: encryptedResponse
                });
            }
        } else {
            const encryptedResponse = encrypt({
                message: 'Patient search completed successfully',
                totalPatients,
                totalPages: Math.ceil(totalPatients / limit),
                currentPage: page,
                patients: patients.map(patient => patient.toObject()),
                appliedFilters: { search, filters }
            });
            
            res.status(200).json({
                data: encryptedResponse
            });
        }
    } catch (error) {
        console.error(error);
        
        // Encrypt error response
        const encryptedError = encrypt({
            error: 'Failed to search patients',
            details: error.message
        });
        
        res.status(500).json({
            data: encryptedError
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
        
        // Encrypt the entire response
        const encryptedResponse = encrypt({
            patient: patient.toObject()
        });
        
        res.status(200).json({
            data: encryptedResponse
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
        // Decrypt the incoming data
        const updates = decrypt(req.body.data);
        
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
        
        // Log the action
        await logAction(
            req.admin._id,
            `${req.admin.firstName} ${req.admin.lastName}`,
            'PATIENT_UPDATED',
            'patient',
            updatedPatient._id,
            `${updatedPatient.firstName} ${updatedPatient.lastName}`,
            `Updated patient information for: ${updatedPatient.firstName} ${updatedPatient.middleName ? updatedPatient.middleName + ' ' : ''}${updatedPatient.lastName}`,
            {
                patientId: updatedPatient._id,
                updatedFields: Object.keys(updates),
                contactNumber: updatedPatient.contactNumber,
                email: updatedPatient.email,
                casesCount: updatedPatient.cases ? updatedPatient.cases.length : 0
            }
        );
        
        // Encrypt the entire response
        const encryptedResponse = encrypt({
            message: 'Patient updated successfully',
            patient: updatedPatient.toObject()
        });
        
        res.status(200).json({
            data: encryptedResponse
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
        
        // Log the action
        await logAction(
            req.admin._id,
            `${req.admin.firstName} ${req.admin.lastName}`,
            'PATIENT_DEACTIVATED',
            'patient',
            patient._id,
            `${patient.firstName} ${patient.lastName}`,
            `Deactivated patient: ${patient.firstName} ${patient.middleName ? patient.middleName + ' ' : ''}${patient.lastName}`,
            {
                patientId: patient._id,
                contactNumber: patient.contactNumber,
                email: patient.email,
                previousStatus: 'Active',
                newStatus: 'Deactivated'
            }
        );
        
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
        
        // Get patient info before deletion for logging
        const patientToDelete = await Patient.findById(id).select('firstName middleName lastName contactNumber email');
        
        if (!patientToDelete) {
            return res.status(404).json({
                message: 'Patient not found'
            });
        }
        
        const result = await Patient.findByIdAndDelete(id);
        
        // Log the action
        await logAction(
            req.admin._id,
            `${req.admin.firstName} ${req.admin.lastName}`,
            'PATIENT_HARD_DELETED',
            'patient',
            id,
            `${patientToDelete.firstName} ${patientToDelete.lastName}`,
            `Permanently deleted patient: ${patientToDelete.firstName} ${patientToDelete.middleName ? patientToDelete.middleName + ' ' : ''}${patientToDelete.lastName}`,
            {
                deletedPatientId: id,
                patientName: `${patientToDelete.firstName} ${patientToDelete.lastName}`,
                contactNumber: patientToDelete.contactNumber,
                email: patientToDelete.email,
                action: 'PERMANENT_DELETION'
            }
        );
        
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
        
        // Encrypt ALL case data before adding
        const encryptedCaseData = encryptPatientData(caseData);
        
        patient.cases.push(encryptedCaseData);
        patient.lastVisit = new Date();
        
        const updatedPatient = await patient.save();
        
        // Decrypt ALL data for response
        const decryptedPatient = decryptPatientData(updatedPatient);
        
        res.status(201).json({
            message: 'Case added successfully',
            patient: decryptedPatient,
            newCase: decryptedPatient.cases[decryptedPatient.cases.length - 1]
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

// Verify verification code
exports.verifyCode = async (req, res) => {
    try {
        const { patientId, code } = req.body;
        
        if (!patientId || !code) {
            return res.status(400).json({
                error: 'Patient ID and verification code are required'
            });
        }
        
        // Get stored verification data
        const verificationData = verificationCodes.get(patientId);
        
        if (!verificationData) {
            return res.status(400).json({
                error: 'Verification code not found or expired'
            });
        }
        
        // Check if code has expired
        if (new Date() > verificationData.expiresAt) {
            verificationCodes.delete(patientId);
            return res.status(400).json({
                error: 'Verification code has expired'
            });
        }
        
        // Check if code matches
        if (verificationData.code !== code) {
            return res.status(400).json({
                error: 'Invalid verification code'
            });
        }
        
        // Code is valid - remove it from storage
        verificationCodes.delete(patientId);
        
        // Get patient details
        const patient = await Patient.findById(patientId).select('firstName middleName lastName email contactNumber');
        
        res.status(200).json({
            message: 'Verification successful',
            verified: true,
            patient
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Verification failed',
            details: error.message
        });
    }
};

// Clean up expired verification codes (call this periodically)
const cleanupExpiredCodes = () => {
    const now = new Date();
    for (const [patientId, data] of verificationCodes.entries()) {
        if (now > data.expiresAt) {
            verificationCodes.delete(patientId);
        }
    }
};

// Clean up expired codes every 5 minutes
setInterval(cleanupExpiredCodes, 5 * 60 * 1000);

// Archive patient (soft delete)
exports.archivePatient = async (req, res) => {
    try {
        const id = req.params.patientId;
        // Decrypt the incoming data
        const decryptedData = decrypt(req.body.data);
        const { isActive, reason } = decryptedData;
        
        // Validate reason for archiving (not required for restoring)
        if (!isActive && (!reason || reason.trim() === '')) {
            const encryptedError = encrypt({
                error: 'Archive reason is required when archiving a patient'
            });
            return res.status(400).json({
                data: encryptedError
            });
        }
        
        const patient = await Patient.findByIdAndUpdate(
            id,
            { $set: { isActive: isActive } },
            { new: true }
        );
        
        if (!patient) {
            const encryptedError = encrypt({
                error: 'Patient not found'
            });
            return res.status(404).json({
                data: encryptedError
            });
        }
        
        // Log the action
        const action = isActive ? 'PATIENT_RESTORED' : 'PATIENT_ARCHIVED';
        const actionDescription = isActive ? 'Restored' : 'Archived';
        const logDescription = isActive 
            ? `Restored patient: ${patient.firstName} ${patient.middleName ? patient.middleName + ' ' : ''}${patient.lastName}`
            : `Archived patient: ${patient.firstName} ${patient.middleName ? patient.middleName + ' ' : ''}${patient.lastName}. Reason: ${reason}`;
        
        await logAction(
            req.admin._id,
            `${req.admin.firstName} ${req.admin.lastName}`,
            action,
            'patient',
            patient._id,
            `${patient.firstName} ${patient.lastName}`,
            logDescription,
            {
                patientId: patient._id,
                contactNumber: patient.contactNumber,
                email: patient.email,
                previousStatus: isActive ? 'Archived' : 'Active',
                newStatus: isActive ? 'Active' : 'Archived',
                ...(reason && { reason: reason.trim() })
            }
        );
        
        // Encrypt the entire response
        const encryptedResponse = encrypt({
            message: `Patient ${isActive ? 'restored' : 'archived'} successfully`,
            patient: patient.toObject()
        });
        
        res.status(200).json({
            data: encryptedResponse
        });
    } catch (error) {
        console.error(error);
        
        // Encrypt error response
        const encryptedError = encrypt({
            error: `Failed to ${decryptedData?.isActive ? 'restore' : 'archive'} patient`,
            details: error.message
        });
        
        res.status(500).json({
            data: encryptedError
        });
    }
};

// Restore patient
exports.restorePatient = async (req, res) => {
    try {
        const id = req.params.patientId;
        // Decrypt the incoming data
        const decryptedData = decrypt(req.body.data);
        const { isActive, reason } = decryptedData;
        
        const patient = await Patient.findByIdAndUpdate(
            id,
            { $set: { isActive: isActive } },
            { new: true }
        );
        
        if (!patient) {
            const encryptedError = encrypt({
                error: 'Patient not found'
            });
            return res.status(404).json({
                data: encryptedError
            });
        }
        
        // Log the action
        const logDescription = reason 
            ? `Restored patient: ${patient.firstName} ${patient.middleName ? patient.middleName + ' ' : ''}${patient.lastName}. Reason: ${reason}`
            : `Restored patient: ${patient.firstName} ${patient.middleName ? patient.middleName + ' ' : ''}${patient.lastName}`;
        
        await logAction(
            req.admin._id,
            `${req.admin.firstName} ${req.admin.lastName}`,
            'PATIENT_RESTORED',
            'patient',
            patient._id,
            `${patient.firstName} ${patient.lastName}`,
            logDescription,
            {
                patientId: patient._id,
                contactNumber: patient.contactNumber,
                email: patient.email,
                previousStatus: 'Archived',
                newStatus: 'Active',
                ...(reason && { reason: reason.trim() })
            }
        );
        
        // Encrypt the entire response
        const encryptedResponse = encrypt({
            message: 'Patient restored successfully',
            patient: patient.toObject()
        });
        
        res.status(200).json({
            data: encryptedResponse
        });
    } catch (error) {
        console.error(error);
        
        // Encrypt error response
        const encryptedError = encrypt({
            error: 'Failed to restore patient',
            details: error.message
        });
        
        res.status(500).json({
            data: encryptedError
        });
    }
};

// Archive multiple patients
exports.archiveMultiplePatients = async (req, res) => {
    try {
        // Decrypt the incoming data
        const decryptedData = decrypt(req.body.data);
        const { patientIds, isActive, reason } = decryptedData;
        
        if (!patientIds || !Array.isArray(patientIds) || patientIds.length === 0) {
            const encryptedError = encrypt({
                error: 'Patient IDs array is required'
            });
            return res.status(400).json({
                data: encryptedError
            });
        }
        
        // Validate reason for bulk archiving (not required for restoring)
        if (!isActive && (!reason || reason.trim() === '')) {
            const encryptedError = encrypt({
                error: 'Archive reason is required when archiving patients'
            });
            return res.status(400).json({
                data: encryptedError
            });
        }
        
        // Get patient names before updating for logging
        const patientsToUpdate = await Patient.find({ _id: { $in: patientIds } }).select('firstName middleName lastName');
        
        const result = await Patient.updateMany(
            { _id: { $in: patientIds } },
            { $set: { isActive: isActive } }
        );
        
        // Log the bulk action
        const action = isActive ? 'PATIENTS_BULK_RESTORED' : 'PATIENTS_BULK_ARCHIVED';
        const actionDescription = isActive ? 'Bulk restored' : 'Bulk archived';
        const patientNames = patientsToUpdate.map(p => `${p.firstName} ${p.lastName}`).join(', ');
        const logDescription = isActive 
            ? `${actionDescription} ${result.modifiedCount} patients: ${patientNames}`
            : `${actionDescription} ${result.modifiedCount} patients: ${patientNames}. Reason: ${reason}`;
        
        await logAction(
            req.admin._id,
            `${req.admin.firstName} ${req.admin.lastName}`,
            action,
            'system', // Use system type for bulk operations to allow null entityId
            null, // No single entity ID for bulk operations
            `${result.modifiedCount} patients`,
            logDescription,
            {
                patientIds: patientIds,
                totalRequested: patientIds.length,
                actuallyModified: result.modifiedCount,
                patientNames: patientNames,
                previousStatus: isActive ? 'Archived' : 'Active',
                newStatus: isActive ? 'Active' : 'Archived',
                operationType: 'BULK_PATIENT_OPERATION',
                ...(reason && { reason: reason.trim() })
            }
        );
        
        // Encrypt the entire response
        const encryptedResponse = encrypt({
            message: `${result.modifiedCount} patients ${isActive ? 'restored' : 'archived'} successfully`,
            updatedCount: result.modifiedCount,
            totalRequested: patientIds.length
        });
        
        res.status(200).json({
            data: encryptedResponse
        });
    } catch (error) {
        console.error(error);
        
        // Encrypt error response
        const encryptedError = encrypt({
            error: 'Failed to update patients',
            details: error.message
        });
        
        res.status(500).json({
            data: encryptedError
        });
    }
};

// Restore multiple patients
exports.restoreMultiplePatients = async (req, res) => {
    try {
        // Decrypt the incoming data
        const decryptedData = decrypt(req.body.data);
        const { patientIds, isActive, reason } = decryptedData;
        
        if (!patientIds || !Array.isArray(patientIds) || patientIds.length === 0) {
            const encryptedError = encrypt({
                error: 'Patient IDs array is required'
            });
            return res.status(400).json({
                data: encryptedError
            });
        }
        
        // Get patient names before updating for logging
        const patientsToUpdate = await Patient.find({ _id: { $in: patientIds } }).select('firstName middleName lastName');
        
        const result = await Patient.updateMany(
            { _id: { $in: patientIds } },
            { $set: { isActive: isActive } }
        );
        
        // Log the bulk action
        const patientNames = patientsToUpdate.map(p => `${p.firstName} ${p.lastName}`).join(', ');
        const logDescription = reason 
            ? `Bulk restored ${result.modifiedCount} patients: ${patientNames}. Reason: ${reason}`
            : `Bulk restored ${result.modifiedCount} patients: ${patientNames}`;
        
        await logAction(
            req.admin._id,
            `${req.admin.firstName} ${req.admin.lastName}`,
            'PATIENTS_BULK_RESTORED',
            'system', // Use system type for bulk operations to allow null entityId
            null, // No single entity ID for bulk operations
            `${result.modifiedCount} patients`,
            logDescription,
            {
                patientIds: patientIds,
                totalRequested: patientIds.length,
                actuallyModified: result.modifiedCount,
                patientNames: patientNames,
                previousStatus: 'Archived',
                newStatus: 'Active',
                operationType: 'BULK_PATIENT_OPERATION',
                ...(reason && { reason: reason.trim() })
            }
        );
        
        // Encrypt the entire response
        const encryptedResponse = encrypt({
            message: `${result.modifiedCount} patients restored successfully`,
            updatedCount: result.modifiedCount,
            totalRequested: patientIds.length
        });
        
        res.status(200).json({
            data: encryptedResponse
        });
    } catch (error) {
        console.error(error);
        
        // Encrypt error response
        const encryptedError = encrypt({
            error: 'Failed to restore patients',
            details: error.message
        });
        
        res.status(500).json({
            data: encryptedError
        });
    }
};

// Simple encryption/decryption - just like inquiry controller
