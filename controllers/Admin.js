const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { generateTokens, setRefreshTokenCookie, clearRefreshTokenCookie } = require('../utils/tokenUtils');

/**
 * @desc    Register a new admin
 * @route   POST /api/admin/register
 * @access  Private/SuperAdmin
 */
exports.registerAdmin = async (req, res) => {
  try {
    const { firstName, lastName, middleName, email, password, role } = req.body;

    console.log('Register attempt with data:', { firstName, lastName, middleName, email, role });

    // Validate input
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Check if admin already exists
    const adminExists = await Admin.findOne({ email });

    if (adminExists) {
      return res.status(400).json({
        success: false,
        message: 'Admin with this email already exists'
      });
    }

    // Create admin with validated role (only superadmin can create another superadmin)
    // If role is not specified or user is not authorized for superadmin creation,
    // default to 'admin' role
    const adminRole = role === 'superadmin' ? role : 'admin';

    console.log('Creating admin with role:', adminRole);

    const admin = await Admin.create({
      firstName,
      lastName,
      middleName,
      email,
      password,
      role: adminRole
    });

    console.log('Admin created successfully:', admin._id);

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(admin);

    // Set refresh token as cookie
    setRefreshTokenCookie(res, refreshToken);

    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      data: {
        admin: {
          id: admin._id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          role: admin.role
        },
        accessToken
      }
    });
  } catch (error) {
    console.error('Admin registration detailed error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register admin',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * @desc    Login admin
 * @route   POST /api/admin/login
 * @access  Public
 */
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check for admin
    const admin = await Admin.findOne({ email }).select('+password');

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // Check if password matches
    const isMatch = await admin.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    admin.lastLogin = Date.now();
    await admin.save({ validateBeforeSave: false });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(admin);

    // Set refresh token as cookie
    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        admin: {
          id: admin._id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          role: admin.role
        },
        accessToken
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Refresh access token
 * @route   POST /api/admin/refresh-token
 * @access  Public (with refresh token)
 */
exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'No refresh token provided'
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Find admin by id
    const admin = await Admin.findById(decoded.id);

    if (!admin || !admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Admin not found or inactive'
      });
    }

    // Generate new tokens
    const tokens = generateTokens(admin);

    // Set new refresh token as cookie
    setRefreshTokenCookie(res, tokens.refreshToken);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: tokens.accessToken
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Logout admin
 * @route   POST /api/admin/logout
 * @access  Private
 */
exports.logoutAdmin = async (req, res) => {
  try {
    // Clear the refresh token cookie
    clearRefreshTokenCookie(res);

    console.log('Refresh token cookie cleared', req.body);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to logout',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
