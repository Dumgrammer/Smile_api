const dotenv = require('dotenv');
dotenv.config();
const Appointment = require('../models/Appointment');
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

// Create a new appointment
exports.createAppointment = async (req, res) => {
  try {
    console.log('Creating appointment with data:', req.body);
    
    if (!req.body.data) {
      return res.status(400).json({ message: 'No encrypted data provided' });
    }
    
    const decryptedData = decrypt(req.body.data);
    console.log('Decrypted data:', decryptedData);
    
    const { patientId, date, startTime, endTime, title } = decryptedData;

    // Validate required fields
    if (!patientId || !date || !startTime || !endTime || !title) {
      return res.status(400).json({ 
        message: 'All fields are required: patientId, date, startTime, endTime, title' 
      });
    }

    // Validate patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Convert date string to Date object if needed
    const appointmentDate = typeof date === 'string' ? new Date(date) : date;
    
    // Validate date is valid
    if (isNaN(appointmentDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    // Check if slot is available
    const isAvailable = await Appointment.isSlotAvailable(appointmentDate, startTime, endTime);
    if (!isAvailable) {
      return res.status(400).json({ 
        message: 'Time slot is not available. Maximum 2 patients per hour allowed.' 
      });
    }

    const appointment = new Appointment({
      patient: patientId,
      date: appointmentDate,
      startTime,
      endTime,
      title
    });

    console.log('Saving appointment:', appointment);
    await appointment.save();
    console.log('Appointment saved successfully');

    // Log the appointment creation
    try {
      await logAction(
        req.admin._id, 
        `${req.admin.firstName} ${req.admin.lastName}`, 
        'APPOINTMENT_CREATED', 
        'appointment', 
        appointment._id, 
        `${patient.firstName} ${patient.lastName}`, 
        `Created appointment: ${title} for ${patient.firstName} ${patient.lastName} on ${date} at ${startTime}-${endTime}`, 
        { 
          appointmentId: appointment._id, 
          patientId: patient._id, 
          patientName: `${patient.firstName} ${patient.lastName}`,
          patientEmail: patient.email,
          appointmentTitle: title,
          appointmentDate: date,
          appointmentTime: `${startTime}-${endTime}`,
          appointmentStatus: appointment.status
        }
      );
      console.log('Log created successfully');
    } catch (logError) {
      console.error('Error creating log:', logError);
      // Don't fail the appointment creation if logging fails
    }

    // Send email notification with enhanced design
    try {
      const mailOptions = {
        from: `"MA Florencio Dental Clinic" <${process.env.APP_EMAIL}>`,
        to: patient.email,
        subject: 'Your Dental Appointment Reminder - MA Florencio Dental Clinic',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
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
              .appointment-details {
                background: #f9fafb;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
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
              .reminder {
                background: #f3f4f6;
                padding: 15px;
                border-radius: 8px;
                margin: 20px 0;
                border-left: 4px solid #7c3aed;
              }
              .footer {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                color: #6b7280;
              }
              .button {
                display: inline-block;
                background: #7c3aed;
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 6px;
                margin: 20px 0;
              }
              .logo {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 10px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">MA Florencio Dental Clinic</div>
                <h1>Appointment Confirmed!</h1>
              </div>
              <div class="content">
                <p>Dear ${patient.firstName} ${patient.lastName},</p>
                <p>We're excited to confirm your upcoming dental appointment with us!</p>
                
                <div class="appointment-details">
                  <h2 style="color: #7c3aed; margin-top: 0;">Appointment Details</h2>
                  <div class="detail-item">
                    <strong>Date:</strong>
                    <span>${new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div class="detail-item">
                    <strong>Time:</strong>
                    <span>${startTime} - ${endTime}</span>
                  </div>
                  <div class="detail-item">
                    <strong>Purpose:</strong>
                    <span>${title}</span>
                  </div>
                </div>

                <div class="reminder">
                  <h3 style="color: #7c3aed; margin-top: 0;">Important Reminders If Applicable</h3>
                  <ul style="margin: 0; padding-left: 20px;">
                    <li>Please arrive 10 minutes before your scheduled time</li>
                    <li>Bring your dental insurance card if applicable</li>
                    <li>Bring a list of any medications you're currently taking</li>
                  </ul>
                </div>

                <p>If you need to reschedule or cancel your appointment, please contact us at least 24 hours in advance.</p>
                
                <div style="text-align: center;">
                  <a href="tel:+1234567890" class="button">Call Us to Reschedule</a>
                </div>

                <div class="footer">
                  <p>Best regards,<br>MA Florencio Dental Clinic Team</p>
                  <p style="font-size: 12px;">
                    This is an automated message, please do not reply directly to this email.<br>
                    For any questions, please call us at (123) 456-7890
                  </p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      };

      // Verify transporter configuration
      await transporter.verify();
      
      // Send email
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      // Don't fail the appointment creation if email fails
    }

    console.log('Sending success response');
    res.status(201).json({ data: encrypt(appointment) });
  } catch (error) {
    console.error('Error creating appointment:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Failed to create appointment', error: error.message });
  }
};

// Create a new public appointment (for online booking)
exports.createPublicAppointment = async (req, res) => {
  try {
    const decryptedData = decrypt(req.body.data);
    const { patientId, date, startTime, endTime, title } = decryptedData;

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
      title,
      status: 'Pending' // Set status to Pending for online appointments
    });

    await appointment.save();

    // Log the public appointment creation
    await logAction(
      null, // No admin for public appointments
      'Public User', 
      'APPOINTMENT_REQUESTED', 
      'appointment', 
      appointment._id, 
      `${patient.firstName} ${patient.lastName}`, 
      `Public appointment request: ${title} for ${patient.firstName} ${patient.lastName} on ${date} at ${startTime}-${endTime}`, 
      { 
        appointmentId: appointment._id, 
        patientId: patient._id, 
        patientName: `${patient.firstName} ${patient.lastName}`,
        patientEmail: patient.email,
        appointmentTitle: title,
        appointmentDate: date,
        appointmentTime: `${startTime}-${endTime}`,
        appointmentStatus: appointment.status,
        requestType: 'PUBLIC_ONLINE'
      }
    );

    // Send email notification with enhanced design
    try {
      const mailOptions = {
        from: `"MA Florencio Dental Clinic" <${process.env.APP_EMAIL}>`,
        to: patient.email,
        subject: 'Your Dental Appointment Request - MA Florencio Dental Clinic',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
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
              .appointment-details {
                background: #f9fafb;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
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
              .status-pending {
                background: #fef3c7;
                color: #92400e;
                padding: 10px;
                border-radius: 6px;
                text-align: center;
                margin: 20px 0;
                border: 1px solid #f59e0b;
              }
              .reminder {
                background: #f3f4f6;
                padding: 15px;
                border-radius: 8px;
                margin: 20px 0;
                border-left: 4px solid #7c3aed;
              }
              .footer {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                color: #6b7280;
              }
              .button {
                display: inline-block;
                background: #7c3aed;
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 6px;
                margin: 20px 0;
              }
              .logo {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 10px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">MA Florencio Dental Clinic</div>
                <h1>Appointment Request Received!</h1>
              </div>
              <div class="content">
                <p>Dear ${patient.firstName} ${patient.lastName},</p>
                <p>Thank you for requesting an appointment with us! Your request has been received and is currently pending confirmation.</p>
                
                <div class="status-pending">
                  <strong>Status: Pending Confirmation</strong><br>
                  We will review your request and confirm your appointment within 24 hours.
                </div>
                
                <div class="appointment-details">
                  <h2 style="color: #7c3aed; margin-top: 0;">Requested Appointment Details</h2>
                  <div class="detail-item">
                    <strong>Date:</strong>
                    <span>${new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div class="detail-item">
                    <strong>Time:</strong>
                    <span>${startTime} - ${endTime}</span>
                  </div>
                  <div class="detail-item">
                    <strong>Purpose:</strong>
                    <span>${title}</span>
                  </div>
                </div>

                <div class="reminder">
                  <h3 style="color: #7c3aed; margin-top: 0;">What Happens Next?</h3>
                  <ul style="margin: 0; padding-left: 20px;">
                    <li>Our team will review your appointment request</li>
                    <li>You will receive a confirmation email within 24 hours</li>
                    <li>If there are any conflicts, we will contact you to reschedule</li>
                    <li>Once confirmed, your appointment will be finalized</li>
                  </ul>
                </div>

                <p>If you need to modify or cancel your request, please contact us as soon as possible.</p>
                
                <div style="text-align: center;">
                  <a href="tel:+1234567890" class="button">Contact Us</a>
                </div>

                <div class="footer">
                  <p>Best regards,<br>MA Florencio Dental Clinic Team</p>
                  <p style="font-size: 12px;">
                    This is an automated message, please do not reply directly to this email.<br>
                    For any questions, please call us at (123) 456-7890
                  </p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      };

      // Verify transporter configuration
      await transporter.verify();
      
      // Send email
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      // Don't fail the appointment creation if email fails
    }

    res.status(201).json({
      data: encrypt({
        message: 'Appointment request created successfully with Pending status',
        appointment: appointment
      })
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper function to check and mark missed appointments
const checkAndMarkMissedAppointments = async () => {
  try {
    const currentDate = new Date();
    const currentTime = currentDate.toTimeString().slice(0, 5); // Get current time in HH:mm format
    
    // Find appointments that are in the past and still have active status
    const missedAppointments = await Appointment.find({
      $or: [
        // Appointments from past dates
        {
          date: { $lt: currentDate.toISOString().split('T')[0] },
          status: { $in: ['Scheduled', 'Pending', 'Rescheduled'] }
        },
        // Appointments from today but time has passed
        {
          date: currentDate.toISOString().split('T')[0],
          endTime: { $lt: currentTime },
          status: { $in: ['Scheduled', 'Pending', 'Rescheduled'] }
        }
      ]
    }).populate('patient', 'firstName lastName middleName email');

    if (missedAppointments.length > 0) {
      // Update all missed appointments to cancelled status
      const updatePromises = missedAppointments.map(async (appointment) => {
        appointment.status = 'Cancelled';
        await appointment.save();

        // Log the automatic cancellation
        try {
          await logAction(
            null, // No admin for automatic cancellations
            'System', 
            'APPOINTMENT_AUTO_CANCELLED', 
            'appointment', 
            appointment._id, 
            `${appointment.patient.firstName} ${appointment.patient.lastName}`, 
            `Automatically cancelled missed appointment: ${appointment.title} for ${appointment.patient.firstName} ${appointment.patient.lastName}`, 
            { 
              appointmentId: appointment._id, 
              patientId: appointment.patient._id, 
              patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
              patientEmail: appointment.patient.email,
              appointmentTitle: appointment.title,
              appointmentDate: appointment.date,
              appointmentTime: `${appointment.startTime}-${appointment.endTime}`,
              previousStatus: 'Active',
              newStatus: 'Cancelled',
              reason: 'Missed appointment - automatically cancelled by system'
            }
          );
        } catch (logError) {
          console.error('Error creating log for auto-cancellation:', logError);
        }

        // Send email notification about the cancellation
        try {
          const mailOptions = {
            from: `"MA Florencio Dental Clinic" <${process.env.APP_EMAIL}>`,
            to: appointment.patient.email,
            subject: 'Missed Appointment - MA Florencio Dental Clinic',
            html: `
              <!DOCTYPE html>
              <html>
              <head>
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
                    background: linear-gradient(to right, #dc2626, #b91c1c);
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
                  .appointment-details {
                    background: #fef2f2;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                    border-left: 4px solid #dc2626;
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
                  .reminder {
                    background: #f3f4f6;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                    border-left: 4px solid #7c3aed;
                  }
                  .footer {
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                    color: #6b7280;
                  }
                  .button {
                    display: inline-block;
                    background: #7c3aed;
                    color: white;
                    padding: 12px 24px;
                    text-decoration: none;
                    border-radius: 6px;
                    margin: 20px 0;
                  }
                  .logo {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 10px;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <div class="logo">MA Florencio Dental Clinic</div>
                    <h1>Missed Appointment Notice</h1>
                  </div>
                  <div class="content">
                    <p>Dear ${appointment.patient.firstName} ${appointment.patient.lastName},</p>
                    <p>We noticed that you missed your scheduled dental appointment. Your appointment has been automatically cancelled.</p>
                    
                    <div class="appointment-details">
                      <h2 style="color: #dc2626; margin-top: 0;">Missed Appointment Details</h2>
                      <div class="detail-item">
                        <strong>Date:</strong>
                        <span>${new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </div>
                      <div class="detail-item">
                        <strong>Time:</strong>
                        <span>${appointment.startTime} - ${appointment.endTime}</span>
                      </div>
                      <div class="detail-item">
                        <strong>Purpose:</strong>
                        <span>${appointment.title}</span>
                      </div>
                    </div>

                    <div class="reminder">
                      <h3 style="color: #7c3aed; margin-top: 0;">Reschedule Your Appointment</h3>
                      <p>We understand that sometimes appointments need to be rescheduled. Please contact us to book a new appointment at your convenience.</p>
                      <ul style="margin: 0; padding-left: 20px;">
                        <li>Call us at (123) 456-7890</li>
                        <li>Visit our website to book online</li>
                        <li>Email us for assistance</li>
                      </ul>
                    </div>

                    <div style="text-align: center;">
                      <a href="tel:+1234567890" class="button">Call to Reschedule</a>
                    </div>

                    <div class="footer">
                      <p>Best regards,<br>MA Florencio Dental Clinic Team</p>
                      <p style="font-size: 12px;">
                        This is an automated message, please do not reply directly to this email.<br>
                        For any questions, please call us at (123) 456-7890
                      </p>
                    </div>
                  </div>
                </div>
              </body>
              </html>
            `
          };

          await transporter.sendMail(mailOptions);
          console.log('Missed appointment email sent successfully');
        } catch (emailError) {
          console.error('Failed to send missed appointment email:', emailError);
        }
      });

      await Promise.all(updatePromises);
      console.log(`Automatically cancelled ${missedAppointments.length} missed appointments`);
    }

    return missedAppointments.length;
  } catch (error) {
    console.error('Error checking missed appointments:', error);
    return 0;
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

    // Check for missed appointments before getting the list
    const missedCount = await checkAndMarkMissedAppointments();

    const appointments = await Appointment.find(query)
      .populate('patient', 'firstName lastName middleName')
      .sort({ date: 1, startTime: 1 });

    res.json({ 
      data: encrypt(appointments),
      missedAppointmentsCancelled: missedCount
    });
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

    res.json({ data: encrypt(appointments) });
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

    res.json({ data: encrypt(appointment) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update appointment (handles status changes automatically for date/time modifications)
// - Pending → Scheduled (when date/time changed)
// - Scheduled → Rescheduled (when date/time changed)
// - Explicit status changes override automatic logic
exports.updateAppointment = async (req, res) => {
  try {
    const decryptedData = decrypt(req.body.data);
    const { date, startTime, endTime, status, title, notes } = decryptedData;
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient', 'firstName lastName email');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // If changing time slot, check availability
    if (date && startTime && endTime) {
      try {
        const isAvailable = await appointment.canBeRescheduled(date, startTime, endTime);
        if (!isAvailable) {
          return res.status(400).json({ 
            message: 'New time slot is not available' 
          });
        }
      } catch (availabilityError) {
        console.error('Error checking availability:', availabilityError);
        return res.status(400).json({ 
          message: 'Error checking time slot availability' 
        });
      }
    }

    // Update fields
    if (date) appointment.date = date;
    if (startTime) appointment.startTime = startTime;
    if (endTime) appointment.endTime = endTime;
    if (title !== undefined) appointment.title = title;
    
    // Handle status changes for date/time modifications:
    // - If previous status was "Pending" and date/time changed → becomes "Scheduled" (approval)
    // - If previous status was "Scheduled" and date/time changed → becomes "Rescheduled" (modification)
    // - If previous status was "Finished" and date/time changed → becomes "Rescheduled" (follow-up)
    // - If status is explicitly provided, use that instead
    if (status) {
      appointment.status = status;
    } else if ((date || startTime || endTime) && appointment.status === 'Pending') {
      appointment.status = 'Scheduled';
    } else if ((date || startTime || endTime) && (appointment.status === 'Scheduled' || appointment.status === 'Finished')) {
      appointment.status = 'Rescheduled';
    }
    // For other statuses (Cancelled, Rescheduled), keep current status

    await appointment.save();

    // Log the appointment update
    try {
      const previousStatus = appointment.status;
      const action = status === 'Finished' ? 'APPOINTMENT_COMPLETED' : 
                     status === 'Cancelled' ? 'APPOINTMENT_CANCELLED' : 
                     status === 'Rescheduled' ? 'APPOINTMENT_RESCHEDULED' : 
                     status === 'Scheduled' ? 'APPOINTMENT_APPROVED' : 
                     'APPOINTMENT_UPDATED';
      
      await logAction(
        req.admin._id, 
        `${req.admin.firstName} ${req.admin.lastName}`, 
        action, 
        'appointment', 
        appointment._id, 
        appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : 'Unknown Patient', 
        `Updated appointment: ${appointment.title} for ${appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : 'Unknown Patient'}. Status: ${previousStatus} → ${appointment.status}`, 
        { 
          appointmentId: appointment._id, 
          patientId: appointment.patient?._id || null, 
          patientName: appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : 'Unknown Patient',
          patientEmail: appointment.patient?.email || null,
          appointmentTitle: appointment.title,
          appointmentDate: appointment.date,
          appointmentTime: `${appointment.startTime}-${appointment.endTime}`,
          previousStatus: previousStatus,
          newStatus: appointment.status,
          changes: {
            date: date || null,
            startTime: startTime || null,
            endTime: endTime || null,
            title: title || null,
            status: status || null
          }
        }
      );
    } catch (logError) {
      console.error('Error creating log:', logError);
      // Don't fail the update if logging fails
    }

    // Send email notification based on status change
    try {
      let subject = '';
      let html = '';

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
          .appointment-details {
            background: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
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
          .reminder {
            background: #f3f4f6;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #7c3aed;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
          }
          .button {
            display: inline-block;
            background: #7c3aed;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .notes-section {
            background: #f0f9ff;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #3b82f6;
          }
        </style>
      `;

      // Determine subject and HTML based on the final appointment.status
      if (appointment.status === 'Finished') {
          subject = 'Appointment Completed - MA Florencio Dental Clinic';
          html = `
            <!DOCTYPE html>
            <html>
            <head>
              ${emailStyles}
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <div class="logo">MA Florencio Dental Clinic</div>
                  <h1>Appointment Completed</h1>
                </div>
                <div class="content">
                  <p>Dear ${appointment.patient.firstName} ${appointment.patient.lastName},</p>
                  <p>Your dental appointment has been completed.</p>
                  <div class="appointment-details">
                    <h2 style="color: #7c3aed; margin-top: 0;">Appointment Details</h2>
                    <div class="detail-item">
                      <strong>Date:</strong>
                      <span>${new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                    <div class="detail-item">
                      <strong>Time:</strong>
                      <span>${appointment.startTime} - ${appointment.endTime}</span>
                    </div>
                    <div class="detail-item">
                      <strong>Purpose:</strong>
                      <span>${appointment.title}</span>
                    </div>
                  </div>
                  ${notes ? `
                    <div class="notes-section">
                      <h2 style="color: #3b82f6; margin-top: 0;">Treatment Summary</h2>
                      <div class="detail-item">
                        <strong>Treatment Notes:</strong>
                        <span>${notes.treatmentNotes}</span>
                      </div>
                      ${notes.reminderNotes ? `
                        <div class="detail-item">
                          <strong>Reminders:</strong>
                          <span>${notes.reminderNotes}</span>
                        </div>
                      ` : ''}
                      <div class="detail-item">
                        <strong>Payment Status:</strong>
                        <span>${notes.payment.status} (${notes.payment.amount})</span>
                      </div>
                    </div>
                  ` : ''}
                  <p>Thank you for choosing MA Florencio Dental Clinic for your dental care needs.</p>
                  <div class="footer">
                    <p>Best regards,<br>The MA Florencio Dental Clinic Team</p>
                  </div>
                </div>
              </div>
            </body>
            </html>
          `;
      } else if (appointment.status === 'Scheduled') {
        subject = 'Appointment Approved - MA Florencio Dental Clinic';
        html = `
          <!DOCTYPE html>
          <html>
          <head>
            ${emailStyles}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">MA Florencio Dental Clinic</div>
                <h1>Appointment Approved</h1>
              </div>
              <div class="content">
                <p>Dear ${appointment.patient.firstName} ${appointment.patient.lastName},</p>
                <p>Your dental appointment has been approved and scheduled.</p>
                <div class="appointment-details">
                  <h2 style="color: #7c3aed; margin-top: 0;">Confirmed Appointment Details</h2>
                  <div class="detail-item">
                    <strong>Date:</strong>
                    <span>${new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div class="detail-item">
                    <strong>Time:</strong>
                    <span>${appointment.startTime} - ${appointment.endTime}</span>
                  </div>
                  <div class="detail-item">
                    <strong>Purpose:</strong>
                    <span>${appointment.title}</span>
                  </div>
                </div>
                <div class="reminder">
                  <h3 style="color: #7c3aed; margin-top: 0;">Important Reminders</h3>
                  <ul style="margin: 0; padding-left: 20px;">
                    <li>Please arrive 10 minutes before your scheduled time</li>
                    <li>Bring your dental insurance card if applicable</li>
                    <li>Bring a list of any medications you're currently taking</li>
                  </ul>
                </div>
                <div class="footer">
                  <p>Best regards,<br>The MA Florencio Dental Clinic Team</p>
                  <p style="font-size: 12px;">
                    This is an automated message, please do not reply directly to this email.<br>
                    For any questions, please call us at (123) 456-7890
                  </p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;
      } else if (appointment.status === 'Rescheduled') {
        subject = 'Appointment Rescheduled - MA Florencio Dental Clinic';
        html = `
          <!DOCTYPE html>
          <html>
          <head>
            ${emailStyles}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">MA Florencio Dental Clinic</div>
                <h1>Appointment Rescheduled</h1>
              </div>
              <div class="content">
                <p>Dear ${appointment.patient.firstName} ${appointment.patient.lastName},</p>
                <p>Your dental appointment has been rescheduled.</p>
                <div class="appointment-details">
                  <h2 style="color: #7c3aed; margin-top: 0;">Updated Appointment Details</h2>
                  <div class="detail-item">
                    <strong>Date:</strong>
                    <span>${new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div class="detail-item">
                    <strong>Time:</strong>
                    <span>${appointment.startTime} - ${appointment.endTime}</span>
                  </div>
                  <div class="detail-item">
                    <strong>Purpose:</strong>
                    <span>${appointment.title}</span>
                  </div>
                </div>
                <div class="reminder">
                  <h3 style="color: #7c3aed; margin-top: 0;">Important Reminders</h3>
                  <ul style="margin: 0; padding-left: 20px;">
                    <li>Please arrive 10 minutes before your scheduled time</li>
                    <li>Bring your dental insurance card if applicable</li>
                    <li>Bring a list of any medications you're currently taking</li>
                  </ul>
                </div>
                <div class="footer">
                  <p>Best regards,<br>The MA Florencio Dental Clinic Team</p>
                  <p style="font-size: 12px;">
                    This is an automated message, please do not reply directly to this email.<br>
                    For any questions, please call us at (123) 456-7890
                  </p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;
      } else if (appointment.status === 'Cancelled') {
        subject = 'Appointment Cancelled - MA Florencio Dental Clinic';
        html = `
          <!DOCTYPE html>
          <html>
          <head>
            ${emailStyles}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">MA Florencio Dental Clinic</div>
                <h1>Appointment Cancelled</h1>
              </div>
              <div class="content">
                <p>Dear ${appointment.patient.firstName} ${appointment.patient.lastName},</p>
                <p>Your dental appointment has been cancelled.</p>
                <div class="appointment-details">
                  <h2 style="color: #7c3aed; margin-top: 0;">Cancelled Appointment Details</h2>
                  <div class="detail-item">
                    <strong>Date:</strong>
                    <span>${new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div class="detail-item">
                    <strong>Time:</strong>
                    <span>${appointment.startTime} - ${appointment.endTime}</span>
                  </div>
                  <div class="detail-item">
                    <strong>Purpose:</strong>
                    <span>${appointment.title}</span>
                  </div>
                </div>
                <p>If you would like to reschedule your appointment, please contact us at (123) 456-7890.</p>
                <div class="footer">
                  <p>Best regards,<br>The MA Florencio Dental Clinic Team</p>
                  <p style="font-size: 12px;">
                    This is an automated message, please do not reply directly to this email.<br>
                    For any questions, please call us at (123) 456-7890
                  </p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;
      } else {
        // Generic update for other statuses
        subject = 'Appointment Updated - MA Florencio Dental Clinic';
        html = `
          <!DOCTYPE html>
          <html>
          <head>
            ${emailStyles}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">MA Florencio Dental Clinic</div>
                <h1>Appointment Updated</h1>
              </div>
              <div class="content">
                <p>Dear ${appointment.patient.firstName} ${appointment.patient.lastName},</p>
                <p>Your dental appointment has been updated.</p>
                <div class="appointment-details">
                  <h2 style="color: #7c3aed; margin-top: 0;">Updated Appointment Details</h2>
                  <div class="detail-item">
                    <strong>Date:</strong>
                    <span>${new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div class="detail-item">
                    <strong>Time:</strong>
                    <span>${appointment.startTime} - ${appointment.endTime}</span>
                  </div>
                  <div class="detail-item">
                    <strong>Purpose:</strong>
                    <span>${appointment.title}</span>
                  </div>
                  <div class="detail-item">
                    <strong>Status:</strong>
                    <span>${appointment.status}</span>
                  </div>
                </div>
                <div class="footer">
                  <p>Best regards,<br>The MA Florencio Dental Clinic Team</p>
                  <p style="font-size: 12px;">
                    This is an automated message, please do not reply directly to this email.<br>
                    For any questions, please call us at (123) 456-7890
                  </p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;
      }

      if (subject && html) {
        const mailOptions = {
          from: `"MA Florencio Dental Clinic" <${process.env.APP_EMAIL}>`,
          to: appointment.patient.email,
          subject: subject,
          html: html
        };

        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully for status:', appointment.status);
      }
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      // Don't fail the appointment update if email fails
    }

    res.json({ data: encrypt(appointment) });
  } catch (error) {
    console.error('Error updating appointment:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Failed to update appointment', error: error.message });
  }
};

// Delete appointment
exports.deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient', 'firstName lastName email');
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Get cancellation reason if provided
    let cancellationReason = 'No reason provided';
    console.log('Request body:', req.body);
    
    if (req.body && req.body.data) {
      try {
        const decryptedData = decrypt(req.body.data);
        console.log('Decrypted cancellation data:', decryptedData);
        if (decryptedData && decryptedData.reason) {
          cancellationReason = decryptedData.reason;
        }
      } catch (decryptError) {
        console.log('Could not decrypt cancellation reason, using default:', decryptError.message);
      }
    } else {
      console.log('No request body or data field found');
    }

    // Instead of deleting, mark as cancelled
    appointment.status = 'Cancelled';
    appointment.cancellationReason = cancellationReason; // Store the reason
    await appointment.save();

    // Log the appointment cancellation
    try {
      await logAction(
        req.admin._id, 
        `${req.admin.firstName} ${req.admin.lastName}`, 
        'APPOINTMENT_CANCELLED', 
        'appointment', 
        appointment._id, 
        appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : 'Unknown Patient', 
        `Cancelled appointment: ${appointment.title} for ${appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : 'Unknown Patient'}. Reason: ${cancellationReason}`, 
        { 
          appointmentId: appointment._id, 
          patientId: appointment.patient?._id || null, 
          patientName: appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : 'Unknown Patient',
          patientEmail: appointment.patient?.email || null,
          appointmentTitle: appointment.title,
          appointmentDate: appointment.date,
          appointmentTime: `${appointment.startTime}-${appointment.endTime}`,
          previousStatus: 'Active',
          newStatus: 'Cancelled',
          cancellationReason: cancellationReason
        }
      );
    } catch (logError) {
      console.error('Error creating log:', logError);
      // Don't fail the cancellation if logging fails
    }

    // Send cancellation email
    try {
      const mailOptions = {
        from: `"MA Florencio Dental Clinic" <${process.env.APP_EMAIL}>`,
        to: appointment.patient.email,
        subject: 'Appointment Cancelled - MA Florencio Dental Clinic',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
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
              .appointment-details {
                background: #f9fafb;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
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
              .button {
                display: inline-block;
                background: #7c3aed;
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 6px;
                margin: 20px 0;
              }
              .logo {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 10px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">MA Florencio Dental Clinic</div>
                <h1>Appointment Cancelled</h1>
              </div>
              <div class="content">
                <p>Dear ${appointment.patient.firstName} ${appointment.patient.lastName},</p>
                <p>Your dental appointment has been cancelled.</p>
                <div class="appointment-details">
                  <h2 style="color: #7c3aed; margin-top: 0;">Cancelled Appointment Details</h2>
                  <div class="detail-item">
                    <strong>Date:</strong>
                    <span>${new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div class="detail-item">
                    <strong>Time:</strong>
                    <span>${appointment.startTime} - ${appointment.endTime}</span>
                  </div>
                  <div class="detail-item">
                    <strong>Purpose:</strong>
                    <span>${appointment.title}</span>
                  </div>
                  <div class="detail-item">
                    <strong>Reason:</strong>
                    <span>${cancellationReason}</span>
                  </div>
                </div>
                <p>If you would like to schedule a new appointment, please contact us.</p>
                <div style="text-align: center;">
                  <a href="tel:+1234567890" class="button">Schedule New Appointment</a>
                </div>
                <div class="footer">
                  <p>Best regards,<br>The MA Florencio Dental Clinic Team</p>
                  <p style="font-size: 12px;">
                    This is an automated message, please do not reply directly to this email.<br>
                    For any questions, please call us at (123) 456-7890
                  </p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log('Cancellation email sent successfully');
    } catch (emailError) {
      console.error('Failed to send cancellation email:', emailError);
      // Don't fail the cancellation if email fails
    }

    res.json({ data: encrypt({ message: 'Appointment cancelled successfully' }) });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Failed to cancel appointment', error: error.message });
  }
};

// Get available time slots for a specific date
exports.getAvailableSlots = async (req, res) => {
  try {
    const { date } = req.params;
    const businessHours = {
      start: '09:00', // Match frontend start time
      end: '17:00'
    };

    console.log('getAvailableSlots called for date:', date);

    // Get all appointments for the date
    const appointments = await Appointment.find({
      date,
      status: { $ne: 'Cancelled' }
    }).sort({ startTime: 1 });

    console.log('Found appointments for date:', appointments.length);

    // Generate 30-minute slots (to match frontend)
    const slots = [];
    let currentHour = 9; // Start at 9 AM
    const endHour = 17; // End at 5 PM

    while (currentHour < endHour) {
      // Generate both :00 and :30 slots for each hour
      for (let minutes = 0; minutes < 60; minutes += 30) {
        const startTime = `${currentHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        const endMinutes = minutes + 30;
        const endTime = endMinutes >= 60 
          ? `${(currentHour + 1).toString().padStart(2, '0')}:00`
          : `${currentHour.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;

        // Check if any appointment conflicts with this slot
        const hasConflict = appointments.some(apt => {
          // Check if appointment overlaps with this time slot
          return (apt.startTime < endTime && apt.endTime > startTime);
        });

        slots.push({
          startTime,
          endTime,
          available: !hasConflict // Available if no conflict
        });

        console.log(`Slot ${startTime}-${endTime}: ${hasConflict ? 'TAKEN' : 'AVAILABLE'}`);
      }
      currentHour++;
    }

    console.log('Total slots generated:', slots.length);
    res.json({ data: encrypt(slots) });
  } catch (error) {
    console.error('Error in getAvailableSlots:', error);
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

    res.json({ data: encrypt(appointments) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reschedule appointment
// Update appointment date/time and set appropriate status:
// - Pending → Scheduled (approval)
// - Scheduled → Rescheduled (modification)
// - Other statuses remain unchanged
exports.rescheduleAppointment = async (req, res) => {
  try {
    const decryptedData = decrypt(req.body.data);
    const { date, startTime, endTime, title } = decryptedData;
    
    // Validate date and time format
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ message: 'Date, start time, and end time are required' });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Validate time format (HH:mm)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({ message: 'Invalid time format. Use HH:mm' });
    }

    const appointment = await Appointment.findById(req.params.id)
      .populate('patient', 'firstName lastName email');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check if new slot is available
    const isAvailable = await appointment.canBeRescheduled(date, startTime, endTime);
    if (!isAvailable) {
      return res.status(400).json({ 
        message: 'New time slot is not available' 
      });
    }

    // Update appointment details
    appointment.date = date;
    appointment.startTime = startTime;
    appointment.endTime = endTime;
    if (title) appointment.title = title;
    
    // Set status based on previous status:
    // - If previous status was "Pending" → becomes "Scheduled" (approval)
    // - If previous status was "Scheduled" → becomes "Rescheduled" (modification)
    if (appointment.status === 'Pending') {
      appointment.status = 'Scheduled';
    } else if (appointment.status === 'Scheduled') {
    appointment.status = 'Rescheduled';
    }
    // For other statuses (Finished, Cancelled, Rescheduled), keep current status

    await appointment.save();

    // Log the appointment rescheduling
    await logAction(
      req.admin._id, 
      `${req.admin.firstName} ${req.admin.lastName}`, 
      'APPOINTMENT_RESCHEDULED', 
      'appointment', 
      appointment._id, 
      `${appointment.patient.firstName} ${appointment.patient.lastName}`, 
      `Rescheduled appointment: ${appointment.title} for ${appointment.patient.firstName} ${appointment.patient.lastName} to ${date} at ${startTime}-${endTime}`, 
      { 
        appointmentId: appointment._id, 
        patientId: appointment.patient._id, 
        patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
        patientEmail: appointment.patient.email,
        appointmentTitle: appointment.title,
        previousDate: appointment.date,
        newDate: date,
        previousTime: `${appointment.startTime}-${appointment.endTime}`,
        newTime: `${startTime}-${endTime}`,
        previousStatus: appointment.status,
        newStatus: appointment.status
      }
    );

    // Send email based on status change
    try {
      let emailSubject, emailTitle;
      if (appointment.status === 'Scheduled') {
        emailSubject = 'Appointment Approved - MA Florencio Dental Clinic';
        emailTitle = 'Appointment Approved';
      } else if (appointment.status === 'Rescheduled') {
        emailSubject = 'Appointment Rescheduled - MA Florencio Dental Clinic';
        emailTitle = 'Appointment Rescheduled';
      } else {
        // For other status changes, use a generic subject
        emailSubject = 'Appointment Updated - MA Florencio Dental Clinic';
        emailTitle = 'Appointment Updated';
      }

      const mailOptions = {
        from: `"MA Florencio Dental Clinic" <${process.env.APP_EMAIL}>`,
        to: appointment.patient.email,
        subject: emailSubject,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
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
              .appointment-details {
                background: #f9fafb;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
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
              .reminder {
                background: #f3f4f6;
                padding: 15px;
                border-radius: 8px;
                margin: 20px 0;
                border-left: 4px solid #7c3aed;
              }
              .footer {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                color: #6b7280;
              }
              .button {
                display: inline-block;
                background: #7c3aed;
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 6px;
                margin: 20px 0;
              }
              .logo {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 10px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">MA Florencio Dental Clinic</div>
                <h1>${emailTitle}</h1>
              </div>
              <div class="content">
                <p>Dear ${appointment.patient.firstName} ${appointment.patient.lastName},</p>
                <p>Your dental appointment has been ${appointment.status === 'Scheduled' ? 'approved' : appointment.status === 'Rescheduled' ? 'rescheduled' : 'updated'}.</p>
                <div class="appointment-details">
                  <h2 style="color: #7c3aed; margin-top: 0;">${appointment.status === 'Scheduled' ? 'Confirmed Appointment Details' : 'Updated Appointment Details'}</h2>
                  <div class="detail-item">
                    <strong>Date:</strong>
                    <span>${new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div class="detail-item">
                    <strong>Time:</strong>
                    <span>${startTime} - ${endTime}</span>
                  </div>
                  <div class="detail-item">
                    <strong>Purpose:</strong>
                    <span>${title || appointment.title}</span>
                  </div>
                </div>
                <div class="reminder">
                  <h3 style="color: #7c3aed; margin-top: 0;">Important Reminders</h3>
                  <ul style="margin: 0; padding-left: 20px;">
                    <li>Please arrive 10 minutes before your scheduled time</li>
                    <li>Bring your dental insurance card if applicable</li>
                    <li>Bring a list of any medications you're currently taking</li>
                  </ul>
                </div>
                <div class="footer">
                  <p>Best regards,<br>The MA Florencio Dental Clinic Team</p>
                  <p style="font-size: 12px;">
                    This is an automated message, please do not reply directly to this email.<br>
                    For any questions, please call us at (123) 456-7890
                  </p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`${emailTitle} email sent successfully`);
    } catch (emailError) {
      console.error('Failed to send appointment update email:', emailError);
      // Don't fail the appointment update if email fails
    }

    res.json({
      data: encrypt({
        message: `Appointment ${appointment.status === 'Scheduled' ? 'approved and scheduled' : appointment.status === 'Rescheduled' ? 'rescheduled' : 'updated'} successfully`,
        appointment: appointment
      })
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Get missed appointments
exports.getMissedAppointments = async (req, res) => {
  try {
    const currentDate = new Date();
    const currentTime = currentDate.toTimeString().slice(0, 5); // Get current time in HH:mm format
    
    // Find appointments that are in the past and still have active status
    const missedAppointments = await Appointment.find({
      $or: [
        // Appointments from past dates
        {
          date: { $lt: currentDate.toISOString().split('T')[0] },
          status: { $in: ['Scheduled', 'Pending', 'Rescheduled'] }
        },
        // Appointments from today but time has passed
        {
          date: currentDate.toISOString().split('T')[0],
          endTime: { $lt: currentTime },
          status: { $in: ['Scheduled', 'Pending', 'Rescheduled'] }
        }
      ]
    }).populate('patient', 'firstName lastName middleName email phone');

    // Format the response data
    const formattedMissedAppointments = missedAppointments.map(appointment => ({
      id: appointment._id,
      patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
      appointmentTime: appointment.date.toISOString().split('T')[0] + ' ' + appointment.startTime,
      service: appointment.title,
      status: appointment.status,
      phone: appointment.patient.phone || 'N/A',
      email: appointment.patient.email || 'N/A',
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      patientId: appointment.patient._id
    }));

    res.json({ 
      data: encrypt(formattedMissedAppointments),
      count: formattedMissedAppointments.length
    });
  } catch (error) {
    console.error('Error getting missed appointments:', error);
    res.status(500).json({ message: 'Failed to get missed appointments', error: error.message });
  }
};

// Update missed appointments (mark them as cancelled)
exports.updateMissedAppointments = async (req, res) => {
  try {
    const currentDate = new Date();
    const currentTime = currentDate.toTimeString().slice(0, 5); // Get current time in HH:mm format
    
    // Find appointments that are in the past and still have active status
    const missedAppointments = await Appointment.find({
      $or: [
        // Appointments from past dates
        {
          date: { $lt: currentDate.toISOString().split('T')[0] },
          status: { $in: ['Scheduled', 'Pending', 'Rescheduled'] }
        },
        // Appointments from today but time has passed
        {
          date: currentDate.toISOString().split('T')[0],
          endTime: { $lt: currentTime },
          status: { $in: ['Scheduled', 'Pending', 'Rescheduled'] }
        }
      ]
    }).populate('patient', 'firstName lastName middleName email');

    if (missedAppointments.length === 0) {
      return res.json({ 
        data: encrypt({ message: 'No missed appointments found' }),
        count: 0
      });
    }

    // Update all missed appointments to cancelled status
    const updatePromises = missedAppointments.map(async (appointment) => {
      appointment.status = 'Cancelled';
      await appointment.save();

      // Log the automatic cancellation
      try {
        await logAction(
          req.admin._id, 
          `${req.admin.firstName} ${req.admin.lastName}`, 
          'APPOINTMENT_AUTO_CANCELLED', 
          'appointment', 
          appointment._id, 
          `${appointment.patient.firstName} ${appointment.patient.lastName}`, 
          `Automatically cancelled missed appointment: ${appointment.title} for ${appointment.patient.firstName} ${appointment.patient.lastName}`, 
          { 
            appointmentId: appointment._id, 
            patientId: appointment.patient._id, 
            patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
            patientEmail: appointment.patient.email,
            appointmentTitle: appointment.title,
            appointmentDate: appointment.date,
            appointmentTime: `${appointment.startTime}-${appointment.endTime}`,
            previousStatus: 'Active',
            newStatus: 'Cancelled',
            reason: 'Missed appointment - automatically cancelled'
          }
        );
      } catch (logError) {
        console.error('Error creating log for auto-cancellation:', logError);
        // Don't fail the update if logging fails
      }

      // Send email notification about the cancellation
      try {
        const mailOptions = {
          from: `"MA Florencio Dental Clinic" <${process.env.APP_EMAIL}>`,
          to: appointment.patient.email,
          subject: 'Missed Appointment - MA Florencio Dental Clinic',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
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
                  background: linear-gradient(to right, #dc2626, #b91c1c);
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
                .appointment-details {
                  background: #fef2f2;
                  padding: 20px;
                  border-radius: 8px;
                  margin: 20px 0;
                  border-left: 4px solid #dc2626;
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
                .reminder {
                  background: #f3f4f6;
                  padding: 15px;
                  border-radius: 8px;
                  margin: 20px 0;
                  border-left: 4px solid #7c3aed;
                }
                .footer {
                  text-align: center;
                  margin-top: 30px;
                  padding-top: 20px;
                  border-top: 1px solid #e5e7eb;
                  color: #6b7280;
                }
                .button {
                  display: inline-block;
                  background: #7c3aed;
                  color: white;
                  padding: 12px 24px;
                  text-decoration: none;
                  border-radius: 6px;
                  margin: 20px 0;
                }
                .logo {
                  font-size: 24px;
                  font-weight: bold;
                  margin-bottom: 10px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <div class="logo">MA Florencio Dental Clinic</div>
                  <h1>Missed Appointment Notice</h1>
                </div>
                <div class="content">
                  <p>Dear ${appointment.patient.firstName} ${appointment.patient.lastName},</p>
                  <p>We noticed that you missed your scheduled dental appointment. Your appointment has been automatically cancelled.</p>
                  
                  <div class="appointment-details">
                    <h2 style="color: #dc2626; margin-top: 0;">Missed Appointment Details</h2>
                    <div class="detail-item">
                      <strong>Date:</strong>
                      <span>${new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                    <div class="detail-item">
                      <strong>Time:</strong>
                      <span>${appointment.startTime} - ${appointment.endTime}</span>
                    </div>
                    <div class="detail-item">
                      <strong>Purpose:</strong>
                      <span>${appointment.title}</span>
                    </div>
                  </div>

                  <div class="reminder">
                    <h3 style="color: #7c3aed; margin-top: 0;">Reschedule Your Appointment</h3>
                    <p>We understand that sometimes appointments need to be rescheduled. Please contact us to book a new appointment at your convenience.</p>
                    <ul style="margin: 0; padding-left: 20px;">
                      <li>Call us at (123) 456-7890</li>
                      <li>Visit our website to book online</li>
                      <li>Email us for assistance</li>
                    </ul>
                  </div>

                  <div style="text-align: center;">
                    <a href="tel:+1234567890" class="button">Call to Reschedule</a>
                  </div>

                  <div class="footer">
                    <p>Best regards,<br>MA Florencio Dental Clinic Team</p>
                    <p style="font-size: 12px;">
                      This is an automated message, please do not reply directly to this email.<br>
                      For any questions, please call us at (123) 456-7890
                    </p>
                  </div>
                </div>
              </div>
            </body>
            </html>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log('Missed appointment email sent successfully');
      } catch (emailError) {
        console.error('Failed to send missed appointment email:', emailError);
        // Don't fail the update if email fails
      }

      return {
        id: appointment._id,
        patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
        appointmentTime: appointment.date.toISOString().split('T')[0] + ' ' + appointment.startTime,
        service: appointment.title,
        status: appointment.status,
        phone: appointment.patient.phone || 'N/A',
        email: appointment.patient.email || 'N/A'
      };
    });

    const updatedAppointments = await Promise.all(updatePromises);

    res.json({ 
      data: encrypt({
        message: `Successfully cancelled ${updatedAppointments.length} missed appointments`,
        appointments: updatedAppointments
      }),
      count: updatedAppointments.length
    });
  } catch (error) {
    console.error('Error updating missed appointments:', error);
    res.status(500).json({ message: 'Failed to update missed appointments', error: error.message });
  }
};

// Cancel appointment with reason (PUT request)
exports.cancelAppointmentWithReason = async (req, res) => {
  console.log('cancelAppointmentWithReason called with ID:', req.params.id);
  console.log('Request body:', req.body);
  
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient', 'firstName lastName email');
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Get cancellation reason
    let cancellationReason = 'No reason provided';
    console.log('Cancel request body:', req.body);
    
    if (req.body && req.body.data) {
      try {
        const decryptedData = decrypt(req.body.data);
        console.log('Decrypted cancellation data:', decryptedData);
        if (decryptedData && decryptedData.cancellationReason) {
          cancellationReason = decryptedData.cancellationReason;
        }
      } catch (decryptError) {
        console.log('Could not decrypt cancellation reason, using default:', decryptError.message);
      }
    }

    // Mark as cancelled
    appointment.status = 'Cancelled';
    appointment.cancellationReason = cancellationReason;
    await appointment.save();

    // Log the appointment cancellation
    try {
      await logAction(
        req.admin._id, 
        `${req.admin.firstName} ${req.admin.lastName}`, 
        'APPOINTMENT_CANCELLED', 
        'appointment', 
        appointment._id, 
        appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : 'Unknown Patient', 
        `Cancelled appointment: ${appointment.title} for ${appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : 'Unknown Patient'}. Reason: ${cancellationReason}`, 
        { 
          appointmentId: appointment._id, 
          patientId: appointment.patient?._id || null, 
          patientName: appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : 'Unknown Patient',
          patientEmail: appointment.patient?.email || null,
          appointmentTitle: appointment.title,
          appointmentDate: appointment.date,
          appointmentTime: `${appointment.startTime}-${appointment.endTime}`,
          previousStatus: 'Active',
          newStatus: 'Cancelled',
          cancellationReason: cancellationReason, 
        }
      );
    } catch (logError) {
      console.error('Error creating log:', logError);
    }

    // Send cancellation email
    try {
      const mailOptions = {
        from: `"MA Florencio Dental Clinic" <${process.env.APP_EMAIL}>`,
        to: appointment.patient.email,
        subject: 'Appointment Cancelled - MA Florencio Dental Clinic',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
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
              .appointment-details {
                background: #f9fafb;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
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
              .button {
                display: inline-block;
                background: #7c3aed;
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 6px;
                margin: 20px 0;
              }
              .logo {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 10px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">MA Florencio Dental Clinic</div>
                <h1>Appointment Cancelled</h1>
              </div>
              <div class="content">
                <p>Dear ${appointment.patient.firstName} ${appointment.patient.lastName},</p>
                <p>Your dental appointment has been cancelled.</p>
                <div class="appointment-details">
                  <h2 style="color: #7c3aed; margin-top: 0;">Cancelled Appointment Details</h2>
                  <div class="detail-item">
                    <strong>Date:</strong>
                    <span>${new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div class="detail-item">
                    <strong>Time:</strong>
                    <span>${appointment.startTime} - ${appointment.endTime}</span>
                  </div>
                  <div class="detail-item">
                    <strong>Purpose:</strong>
                    <span>${appointment.title}</span>
                  </div>
                  <div class="detail-item">
                    <strong>Reason:</strong>
                    <span>${cancellationReason}</span>
                  </div>
                </div>
                <p>If you would like to schedule a new appointment, please contact us.</p>
                <div style="text-align: center;">
                  <a href="tel:+1234567890" class="button">Schedule New Appointment</a>
                </div>
                <div class="footer">
                  <p>Best regards,<br>The MA Florencio Dental Clinic Team</p>
                  <p style="font-size: 12px;">
                    This is an automated message, please do not reply directly to this email.<br>
                    For any questions, please call us at (123) 456-7890
                  </p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log('Cancellation email sent successfully');
    } catch (emailError) {
      console.error('Failed to send cancellation email:', emailError);
    }

    res.json({ data: encrypt({ message: 'Appointment cancelled successfully' }) });
  } catch (error) {
    console.error('Error cancelling appointment with reason:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Failed to cancel appointment', error: error.message });
  }
};

// Get appointments for a specific patient (public endpoint for online booking)
exports.getPatientAppointmentsPublic = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { includeHistory } = req.query; // Check if history should be included

    console.log('getPatientAppointmentsPublic called for patient:', patientId, 'includeHistory:', includeHistory);

    // Validate patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    let query = { patient: patientId };
    let sortOrder = { date: 1, startTime: 1 }; // Default: ascending (upcoming first)

    if (includeHistory === 'true') {
      // Get all appointments (including past and cancelled)
      // Sort by date descending to show recent appointments first
      sortOrder = { date: -1, startTime: -1 };
    } else {
      // Get upcoming appointments only (not cancelled, and future or today's dates)
      const currentDate = new Date();
      const currentDateString = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      console.log('Current date for filtering:', currentDateString);
      
      query = {
        patient: patientId,
        date: { $gte: currentDateString }, // Use string comparison for dates
        status: { $ne: 'Cancelled' }
      };
      
      console.log('Query for upcoming appointments:', query);
    }

    const appointments = await Appointment.find(query).sort(sortOrder);

    console.log('Found appointments:', appointments.length, includeHistory === 'true' ? '(including history)' : '(upcoming only)');

    res.json({ data: encrypt(appointments) });
  } catch (error) {
    console.error('Error in getPatientAppointmentsPublic:', error);
    res.status(500).json({ message: error.message });
  }
};