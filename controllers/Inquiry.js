const dotenv = require('dotenv');
dotenv.config();
const Inquiry = require('../models/Inquiry');
const { encrypt, decrypt } = require('../utils/crypto');
const nodemailer = require('nodemailer');
const { logAction } = require('./Logs');

// Configure nodemailer with Gmail SMTP (same as Appointment controller)
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

// Send inquiry confirmation email
const sendInquiryConfirmationEmail = async (inquiry) => {
  try {
    const mailOptions = {
      from: `"MA Florencio Dental Clinic" <${process.env.APP_EMAIL}>`,
      to: inquiry.email,
      subject: `Thank you for contacting MA Florencio Dental Clinic - ${inquiry.subject}`,
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
            .inquiry-details {
              background: #f9fafb;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .detail-item {
              margin: 10px 0;
              display: flex;
              align-items: flex-start;
            }
            .detail-item strong {
              width: 120px;
              color: #4b5563;
              flex-shrink: 0;
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
            .office-hours {
              background: #f0f9ff;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              border-left: 4px solid #3b82f6;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">MA Florencio Dental Clinic</div>
              <h1>Thank you for your inquiry!</h1>
            </div>
            <div class="content">
              <p>Dear ${inquiry.fullName},</p>
              <p>We have received your message and appreciate you taking the time to contact us. Our team will review your inquiry and respond within 24-48 hours.</p>
              
              <div class="inquiry-details">
                <h2 style="color: #7c3aed; margin-top: 0;">Your Inquiry Details</h2>
                <div class="detail-item">
                  <strong>Subject:</strong>
                  <span>${inquiry.subject}</span>
                </div>
                <div class="detail-item">
                  <strong>Message:</strong>
                  <span>${inquiry.message}</span>
                </div>
                <div class="detail-item">
                  <strong>Phone:</strong>
                  <span>${inquiry.phone}</span>
                </div>
                <div class="detail-item">
                  <strong>Date Received:</strong>
                  <span>${inquiry.formattedCreatedAt}</span>
                </div>
              </div>

              <div class="reminder">
                <h3 style="color: #7c3aed; margin-top: 0;">What Happens Next?</h3>
                <ul style="margin: 0; padding-left: 20px;">
                  <li>Our team will review your inquiry carefully</li>
                  <li>You will receive a response within 24-48 hours</li>
                  <li>For urgent dental concerns, please call us directly</li>
                  <li>We may contact you by phone if additional information is needed</li>
                </ul>
              </div>

              <div class="office-hours">
                <h3 style="color: #3b82f6; margin-top: 0;">Our Office Hours</h3>
                <div class="detail-item">
                  <strong>Monday - Friday:</strong>
                  <span>9:00 AM - 6:00 PM</span>
                </div>
                <div class="detail-item">
                  <strong>Saturday & Sunday:</strong>
                  <span>Upon Schedule</span>
                </div>
                <div class="detail-item" style="margin-top: 15px;">
                  <strong>Location:</strong>
                  <span>M&F Building National Road cor. Govic Highway<br>Brgy. Del Pilar, Castillejos, Philippines</span>
                </div>
              </div>
              
              <p>Thank you for choosing MA Florencio Dental Clinic for your dental care needs!</p>

              <div style="text-align: center;">
                <a href="tel:+1234567890" class="button">Call Us for Urgent Concerns</a>
              </div>

              <div class="footer">
                <p>Best regards,<br>MA Florencio Dental Clinic Team</p>
                <p style="font-size: 12px;">
                  This is an automated message, please do not reply directly to this email.<br>
                  Founded in 2015 | For urgent matters, please call us directly
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
    console.log('Inquiry confirmation email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending inquiry confirmation email:', error);
    return false;
  }
};

// Create a new inquiry
exports.createInquiry = async (req, res) => {
  try {
    // Decrypt the request payload
    const decryptedData = decrypt(req.body.data);
    
    const { fullName, email, phone, subject, message } = decryptedData;

    // Validate required fields
    if (!fullName || !email || !phone || !subject || !message) {
      const response = { error: 'All fields are required' };
      return res.status(400).json({ data: encrypt(response) });
    }

    // Create new inquiry
    const inquiry = new Inquiry({
      fullName,
      email,
      phone,
      subject,
      message
    });

    await inquiry.save();

    // Send confirmation email
    const emailSent = await sendInquiryConfirmationEmail(inquiry);

    const response = {
      message: 'Inquiry submitted successfully',
      inquiryId: inquiry._id,
      emailSent
    };

    res.status(201).json({ data: encrypt(response) });
  } catch (error) {
    console.error('Error creating inquiry:', error);
    const response = { error: 'Failed to submit inquiry. Please try again.' };
    res.status(500).json({ data: encrypt(response) });
  }
};

// Get all inquiries (admin only)
exports.getAllInquiries = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { status, archived } = req.query;
    
    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (archived !== undefined) filter.isArchived = archived === 'true';

    const skip = (page - 1) * limit;
    
    const inquiries = await Inquiry.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .exec();

    const total = await Inquiry.countDocuments(filter);
    const stats = await Inquiry.getStats();

    const response = {
      inquiries,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
      stats
    };

    res.status(200).json({ data: encrypt(response) });
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    const response = { error: 'Failed to fetch inquiries' };
    res.status(500).json({ data: encrypt(response) });
  }
};

// Get single inquiry by ID (admin only)
exports.getInquiryById = async (req, res) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id);
    
    if (!inquiry) {
      const response = { error: 'Inquiry not found' };
      return res.status(404).json({ data: encrypt(response) });
    }

    // Mark as read if it was unread
    if (inquiry.status === 'Unread') {
      await inquiry.markAsRead();
    }

    const response = { inquiry };
    res.status(200).json({ data: encrypt(response) });
  } catch (error) {
    console.error('Error fetching inquiry:', error);
    const response = { error: 'Failed to fetch inquiry' };
    res.status(500).json({ data: encrypt(response) });
  }
};

// Update inquiry status (admin only)
exports.updateInquiryStatus = async (req, res) => {
  try {
    const decryptedData = decrypt(req.body.data);
    const { status } = decryptedData;

    if (!['Unread', 'Read', 'Replied'].includes(status)) {
      const response = { error: 'Invalid status' };
      return res.status(400).json({ data: encrypt(response) });
    }

    const inquiry = await Inquiry.findById(req.params.id);
    
    if (!inquiry) {
      const response = { error: 'Inquiry not found' };
      return res.status(404).json({ data: encrypt(response) });
    }

    const oldStatus = inquiry.status;
    inquiry.status = status;
    await inquiry.save();

    // Log the action
    await logAction(
      req.admin._id,
      `${req.admin.firstName} ${req.admin.lastName}`,
      'INQUIRY_STATUS_UPDATED',
      'inquiry',
      inquiry._id,
      `${inquiry.subject} - ${inquiry.fullName}`,
      `Updated inquiry status from "${oldStatus}" to "${status}"`,
      { oldStatus, newStatus: status, inquiryId: inquiry._id }
    );

    const response = { 
      message: 'Inquiry status updated successfully',
      inquiry 
    };
    
    res.status(200).json({ data: encrypt(response) });
  } catch (error) {
    console.error('Error updating inquiry status:', error);
    const response = { error: 'Failed to update inquiry status' };
    res.status(500).json({ data: encrypt(response) });
  }
};

// Archive inquiry (admin only)
exports.archiveInquiry = async (req, res) => {
  try {
    const decryptedData = decrypt(req.body.data);
    const { reason, archivedBy } = decryptedData;

    // Validate reason is required
    if (!reason || reason.trim() === '') {
      const response = { error: 'Archive reason is required' };
      return res.status(400).json({ data: encrypt(response) });
    }

    const inquiry = await Inquiry.findById(req.params.id);
    
    if (!inquiry) {
      const response = { error: 'Inquiry not found' };
      return res.status(404).json({ data: encrypt(response) });
    }

    await inquiry.archive(reason.trim(), archivedBy || 'Admin');

    // Log the action
    await logAction(
      req.admin._id,
      `${req.admin.firstName} ${req.admin.lastName}`,
      'INQUIRY_ARCHIVED',
      'inquiry',
      inquiry._id,
      `${inquiry.subject} - ${inquiry.fullName}`,
      `Archived inquiry with reason: "${reason.trim()}"`,
      { 
        archiveReason: reason.trim(), 
        archivedBy: archivedBy || 'Admin', 
        inquiryId: inquiry._id,
        inquirySubject: inquiry.subject,
        customerName: inquiry.fullName,
        customerEmail: inquiry.email
      }
    );

    const response = { 
      message: 'Inquiry archived successfully',
      inquiry 
    };
    
    res.status(200).json({ data: encrypt(response) });
  } catch (error) {
    console.error('Error archiving inquiry:', error);
    const response = { error: 'Failed to archive inquiry' };
    res.status(500).json({ data: encrypt(response) });
  }
};

// Unarchive inquiry (admin only)
exports.unarchiveInquiry = async (req, res) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id);
    
    if (!inquiry) {
      const response = { error: 'Inquiry not found' };
      return res.status(404).json({ data: encrypt(response) });
    }

    await inquiry.unarchive();

    // Log the action
    await logAction(
      req.admin._id,
      `${req.admin.firstName} ${req.admin.lastName}`,
      'INQUIRY_RESTORED',
      'inquiry',
      inquiry._id,
      `${inquiry.subject} - ${inquiry.fullName}`,
      `Restored inquiry from archive`,
      { 
        inquiryId: inquiry._id,
        inquirySubject: inquiry.subject,
        customerName: inquiry.fullName,
        customerEmail: inquiry.email,
        previousArchiveReason: inquiry.archiveReason
      }
    );

    const response = { 
      message: 'Inquiry unarchived successfully',
      inquiry 
    };
    
    res.status(200).json({ data: encrypt(response) });
  } catch (error) {
    console.error('Error unarchiving inquiry:', error);
    const response = { error: 'Failed to unarchive inquiry' };
    res.status(500).json({ data: encrypt(response) });
  }
};

// Delete inquiry (admin only)
exports.deleteInquiry = async (req, res) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id);
    
    if (!inquiry) {
      const response = { error: 'Inquiry not found' };
      return res.status(404).json({ data: encrypt(response) });
    }

    // Log the action before deletion
    await logAction(
      req.admin._id,
      `${req.admin.firstName} ${req.admin.lastName}`,
      'INQUIRY_DELETED',
      'inquiry',
      inquiry._id,
      `${inquiry.subject} - ${inquiry.fullName}`,
      `Permanently deleted inquiry`,
      { 
        inquiryId: inquiry._id,
        inquirySubject: inquiry.subject,
        customerName: inquiry.fullName,
        customerEmail: inquiry.email,
        customerPhone: inquiry.phone,
        inquiryMessage: inquiry.message,
        inquiryStatus: inquiry.status,
        wasArchived: inquiry.isArchived,
        archiveReason: inquiry.archiveReason || null
      }
    );

    await Inquiry.findByIdAndDelete(req.params.id);

    const response = { message: 'Inquiry deleted successfully' };
    res.status(200).json({ data: encrypt(response) });
  } catch (error) {
    console.error('Error deleting inquiry:', error);
    const response = { error: 'Failed to delete inquiry' };
    res.status(500).json({ data: encrypt(response) });
  }
};

// Reply to inquiry (admin only)
exports.replyToInquiry = async (req, res) => {
  try {
    const decryptedData = decrypt(req.body.data);
    const { replyMessage } = decryptedData;

    if (!replyMessage || replyMessage.trim() === '') {
      const response = { error: 'Reply message is required' };
      return res.status(400).json({ data: encrypt(response) });
    }

    const inquiry = await Inquiry.findById(req.params.id);
    
    if (!inquiry) {
      const response = { error: 'Inquiry not found' };
      return res.status(404).json({ data: encrypt(response) });
    }

    // Update inquiry status to replied
    inquiry.status = 'Replied';
    await inquiry.save();

    // Send reply email (implementation would go here)
    // const emailSent = await sendReplyEmail(inquiry, replyMessage);

    // Log the action
    await logAction(
      req.admin._id,
      `${req.admin.firstName} ${req.admin.lastName}`,
      'INQUIRY_REPLIED',
      'inquiry',
      inquiry._id,
      `${inquiry.subject} - ${inquiry.fullName}`,
      `Replied to inquiry`,
      { 
        inquiryId: inquiry._id,
        inquirySubject: inquiry.subject,
        customerName: inquiry.fullName,
        customerEmail: inquiry.email,
        replyMessage: replyMessage.trim(),
        repliedBy: `${req.admin.firstName} ${req.admin.lastName}`
      }
    );

    const response = { 
      message: 'Reply sent successfully',
      inquiry 
    };
    
    res.status(200).json({ data: encrypt(response) });
  } catch (error) {
    console.error('Error replying to inquiry:', error);
    const response = { error: 'Failed to send reply' };
    res.status(500).json({ data: encrypt(response) });
  }
};

// Get inquiry statistics (admin only)
exports.getInquiryStats = async (req, res) => {
  try {
    const stats = await Inquiry.getStats();
    
    const response = { stats };
    res.status(200).json({ data: encrypt(response) });
  } catch (error) {
    console.error('Error fetching inquiry stats:', error);
    const response = { error: 'Failed to fetch inquiry statistics' };
    res.status(500).json({ data: encrypt(response) });
  }
};
