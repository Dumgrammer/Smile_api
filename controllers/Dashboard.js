const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Notes = require('../models/Notes');
const Inquiry = require('../models/Inquiry');

const getStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // 1. Total visitors this month (unique patients with appointments this month)
    const visitorsThisMonth = await Appointment.distinct('patient', {
      date: { $gte: startOfMonth, $lte: endOfMonth },
      status: { $ne: 'Cancelled' }
    });
    const totalVisitors = visitorsThisMonth.length;

    // 2. Active patients
    const activePatients = await Patient.countDocuments({ isActive: true });

    // 3. Total revenue (Paid notes this month)
    const paidNotesThisMonth = await Notes.aggregate([
      {
        $match: {
          'payment.status': 'Paid',
          createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$payment.amount' }
        }
      }
    ]);
    const totalRevenue = paidNotesThisMonth[0]?.total || 0;

    // 4. Growth rate (revenue growth compared to last month)
    const paidNotesLastMonth = await Notes.aggregate([
      {
        $match: {
          'payment.status': 'Paid',
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$payment.amount' }
        }
      }
    ]);
    const lastMonthRevenue = paidNotesLastMonth[0]?.total || 0;
    let growthRate = 0;
    if (lastMonthRevenue > 0) {
      growthRate = ((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
    } else if (totalRevenue > 0) {
      growthRate = 100;
    }

    res.json({
      totalVisitors,
      activePatients,
      totalRevenue,
      growthRate: Number(growthRate.toFixed(2)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

// New: Clinic activity trend for the last 90 days
const getActivityTrend = async (req, res) => {
  try {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89, 0, 0, 0, 0); // 90 days ago
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Get treated patients per day (patients with finished appointments)
    const treatedPatientsData = await Appointment.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          status: 'Finished'
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            patient: '$patient'
          }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          treatedPatients: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Get scheduled appointments per day
    const scheduledAppointmentsData = await Appointment.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          status: { $in: ['Scheduled', 'Confirmed'] }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$date' }
          },
          scheduledAppointments: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Get inquiries per day
    const inquiriesData = await Inquiry.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          inquiries: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Fill in missing days with 0 values
    const result = [];
    for (let i = 0; i < 90; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().slice(0, 10);
      
      const treatedFound = treatedPatientsData.find(r => r._id === dateStr);
      const scheduledFound = scheduledAppointmentsData.find(r => r._id === dateStr);
      const inquiriesFound = inquiriesData.find(r => r._id === dateStr);
      
      result.push({ 
        date: dateStr, 
        treatedPatients: treatedFound ? treatedFound.treatedPatients : 0,
        scheduledAppointments: scheduledFound ? scheduledFound.scheduledAppointments : 0,
        inquiries: inquiriesFound ? inquiriesFound.inquiries : 0
      });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch activity trend' });
  }
};

module.exports = { getStats, getActivityTrend }; 