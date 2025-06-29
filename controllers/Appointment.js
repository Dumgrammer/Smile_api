const dotenv = require('dotenv');
dotenv.config();
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const nodemailer = require('nodemailer');

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
    const { date, startTime, endTime, status, title, notes } = req.body;
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient', 'firstName lastName email');

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

      switch (status) {
        case 'Finished':
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
          break;
      }

      if (subject && html) {
        const mailOptions = {
          from: `"MA Florencio Dental Clinic" <${process.env.APP_EMAIL}>`,
          to: appointment.patient.email,
          subject: subject,
          html: html
        };

        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully for status:', status);
      }
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      // Don't fail the appointment update if email fails
    }

    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: error.message });
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

    // Instead of deleting, mark as cancelled
    appointment.status = 'Cancelled';
    await appointment.save();

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

// Reschedule appointment
exports.rescheduleAppointment = async (req, res) => {
  try {
    const { date, startTime, endTime, title } = req.body;
    
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
    appointment.status = 'Rescheduled';

    await appointment.save();

    // Send rescheduling email
    try {
      const mailOptions = {
        from: `"MA Florencio Dental Clinic" <${process.env.APP_EMAIL}>`,
        to: appointment.patient.email,
        subject: 'Appointment Rescheduled - MA Florencio Dental Clinic',
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
                <h1>Appointment Rescheduled</h1>
              </div>
              <div class="content">
                <p>Dear ${appointment.patient.firstName} ${appointment.patient.lastName},</p>
                <p>Your dental appointment has been rescheduled.</p>
                <div class="appointment-details">
                  <h2 style="color: #7c3aed; margin-top: 0;">New Appointment Details</h2>
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
      console.log('Rescheduling email sent successfully');
    } catch (emailError) {
      console.error('Failed to send rescheduling email:', emailError);
      // Don't fail the rescheduling if email fails
    }

    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
