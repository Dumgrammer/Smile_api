require('dotenv').config();
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const morgan = require('morgan');
app.use(morgan('dev'));
app.use(express.json());


app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*"),
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization");
        if (req.method === 'OPTIONS') {
            res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE');
            return res.status(200).json({

            });
        }
        next();
});

mongoose.connect(process.env.MONGODB_CONN)
.then(()=> {
    console.log("Database connected")
})
.catch((err) => {
    console.error(err);
});
mongoose.Promise = global.Promise;

const adminRoutes = require('./routes/Admin');
const patientRoutes = require('./routes/Patient');
const appointmentRoutes = require('./routes/Appointment');
const notesRoutes = require('./routes/Notes');
const inquiryRoutes = require('./routes/Inquiry');
const logRoutes = require('./routes/Logs');

app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/notes', notesRoutes);
app.use('/api/v1/inquiry', inquiryRoutes);
app.use('/api/v1/logs', logRoutes);

app.use((req, res, next) => {
    const error = new Error('Not Found');
    error.status = 404;
    next(error);
});


//Error handler for functions
app.use((error, req, res, next) => {
    res.status(error.status || 500);
    res.json({
        error: {
            message: error.message
        }
    })
});

module.exports = app;