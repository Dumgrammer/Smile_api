const Log = require('../models/Logs');
const { encrypt, decrypt } = require('../utils/crypto');

// Helper function to extract client info from request
const getClientInfo = (req) => {
  return {
    ipAddress: req.ip || req.connection.remoteAddress || req.socket.remoteAddress,
    userAgent: req.get('User-Agent') || 'Unknown'
  };
};

// Create a log entry
exports.createLog = async (req, res) => {
  try {
    const decryptedData = decrypt(req.body.data);
    const { 
      action, 
      entityType, 
      entityId, 
      entityName, 
      description, 
      details 
    } = decryptedData;

    // Validate required fields
    if (!action || !entityType || !description) {
      const response = { error: 'Missing required fields: action, entityType, description' };
      return res.status(400).json({ data: encrypt(response) });
    }

    const clientInfo = getClientInfo(req);

    const logData = {
      adminId: req.admin?._id || null,
      adminName: req.admin ? `${req.admin.firstName} ${req.admin.lastName}` : 'Public User',
      action,
      entityType,
      entityId,
      entityName,
      description,
      details: details || {},
      ...clientInfo
    };

    const log = await Log.createLog(logData);

    const response = {
      message: 'Log created successfully',
      logId: log._id
    };

    res.status(201).json({ data: encrypt(response) });
  } catch (error) {
    console.error('Error creating log:', error);
    const response = { error: 'Failed to create log' };
    res.status(500).json({ data: encrypt(response) });
  }
};

// Get all logs with pagination and filters
exports.getAllLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      adminId,
      action,
      entityType,
      startDate,
      endDate
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      adminId,
      action,
      entityType,
      startDate,
      endDate
    };

    const result = await Log.getLogsPaginated(options);

    const response = {
      logs: result.logs,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      total: result.total
    };

    res.status(200).json({ data: encrypt(response) });
  } catch (error) {
    console.error('Error fetching logs:', error);
    const response = { error: 'Failed to fetch logs' };
    res.status(500).json({ data: encrypt(response) });
  }
};

// Get log statistics
exports.getLogStats = async (req, res) => {
  try {
    const { adminId } = req.query;
    const stats = await Log.getStats(adminId);

    const response = { stats };
    res.status(200).json({ data: encrypt(response) });
  } catch (error) {
    console.error('Error fetching log stats:', error);
    const response = { error: 'Failed to fetch log statistics' };
    res.status(500).json({ data: encrypt(response) });
  }
};

// Get logs by admin ID
exports.getLogsByAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      adminId
    };

    const result = await Log.getLogsPaginated(options);

    const response = {
      logs: result.logs,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      total: result.total
    };

    res.status(200).json({ data: encrypt(response) });
  } catch (error) {
    console.error('Error fetching admin logs:', error);
    const response = { error: 'Failed to fetch admin logs' };
    res.status(500).json({ data: encrypt(response) });
  }
};

// Get logs by entity
exports.getLogsByEntity = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      entityType,
      entityId
    };

    const result = await Log.getLogsPaginated(options);

    const response = {
      logs: result.logs,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      total: result.total
    };

    res.status(200).json({ data: encrypt(response) });
  } catch (error) {
    console.error('Error fetching entity logs:', error);
    const response = { error: 'Failed to fetch entity logs' };
    res.status(500).json({ data: encrypt(response) });
  }
};

// Delete old logs (cleanup utility)
exports.deleteOldLogs = async (req, res) => {
  try {
    const { days = 90 } = req.query; // Default: delete logs older than 90 days
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    const result = await Log.deleteMany({
      createdAt: { $lt: cutoffDate }
    });

    const response = {
      message: `Deleted ${result.deletedCount} old log entries`,
      deletedCount: result.deletedCount
    };

    res.status(200).json({ data: encrypt(response) });
  } catch (error) {
    console.error('Error deleting old logs:', error);
    const response = { error: 'Failed to delete old logs' };
    res.status(500).json({ data: encrypt(response) });
  }
};

// Helper function to create log entries from other controllers
exports.logAction = async (adminId, adminName, action, entityType, entityId, entityName, description, details = {}) => {
  try {
    const logData = {
      adminId,
      adminName,
      action,
      entityType,
      entityId,
      entityName,
      description,
      details
    };

    await Log.createLog(logData);
    console.log(`Log created: ${action} by ${adminName}`);
  } catch (error) {
    console.error('Error creating log entry:', error);
    // Don't throw error to avoid breaking the main operation
  }
};
