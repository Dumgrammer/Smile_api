const mongoose = require('mongoose');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Inquiry = require('../models/Inquiry');
const Notes = require('../models/Notes');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_CONN);
    console.log('MongoDB connected for seeding...');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Sample data
const firstNames = [
  'Juan', 'Maria', 'Jose', 'Ana', 'Carlos', 'Elena', 'Miguel', 'Carmen', 'Roberto', 'Rosa',
  'Antonio', 'Isabel', 'Francisco', 'Teresa', 'Manuel', 'Patricia', 'David', 'Gloria', 'Rafael', 'Angela'
];

const lastNames = [
  'Santos', 'Cruz', 'Garcia', 'Reyes', 'Ramos', 'Dela Cruz', 'Mendoza', 'Flores', 'Gonzales', 'Torres',
  'Rivera', 'Lopez', 'Aquino', 'Morales', 'Castillo', 'Villanueva', 'Francisco', 'Bautista', 'Pascual', 'Domingo'
];

const middleNames = [
  'De Leon', 'Villanueva', 'San Jose', 'Del Rosario', 'Santiago', 'Martinez', 'Fernandez', 'Hernandez', 'Jimenez', 'Vargas'
];

const cities = [
  'Castillejos', 'Subic', 'Olongapo', 'San Marcelino', 'San Antonio', 'Botolan', 'Cabangan', 'San Felipe', 'San Narciso', 'Palauig'
];

const streets = [
  'Rizal Street', 'National Highway', 'Maharlika Highway', 'Del Pilar Street', 'Burgos Avenue', 'Luna Street',
  'Gomez Street', 'Mabini Avenue', 'Bonifacio Street', 'Aguinaldo Street'
];

const appointmentTitles = [
  'Dental Cleaning', 'Tooth Extraction', 'Dental Filling', 'Root Canal', 'Dental Crown', 'Teeth Whitening',
  'Orthodontic Consultation', 'Dental Implant', 'Gum Treatment', 'Dental Check-up', 'Wisdom Tooth Removal',
  'Cavity Treatment', 'Dental Bridge', 'Oral Surgery', 'Preventive Care'
];

const inquirySubjects = [
  'Dental Cleaning Inquiry', 'Tooth Pain Consultation', 'Orthodontic Treatment', 'Teeth Whitening Cost',
  'Emergency Dental Care', 'Root Canal Questions', 'Dental Insurance Coverage', 'Appointment Scheduling',
  'Wisdom Tooth Removal', 'Pediatric Dental Care', 'Cosmetic Dentistry', 'Dental Implant Information',
  'Payment Options', 'Dental X-ray Results', 'Follow-up Treatment'
];

const inquiryMessages = [
  'I would like to schedule a dental cleaning appointment. What are your available dates?',
  'I have been experiencing tooth pain for the past few days. Can you help me?',
  'My child needs orthodontic treatment. Do you offer services for children?',
  'I am interested in teeth whitening procedures. Could you provide more information about costs?',
  'I have a dental emergency and need immediate care. Are you available today?',
  'I need a root canal treatment. How long does the procedure take?',
  'Does my insurance cover dental treatments at your clinic?',
  'I would like to schedule a routine check-up for next week.',
  'My wisdom tooth is causing pain. Do you perform extractions?',
  'What preventive dental care do you recommend for my family?',
  'I am interested in cosmetic dentistry procedures. What options do you offer?',
  'I need information about dental implants. What is the process like?',
  'What payment options do you accept for dental treatments?',
  'I received my X-ray results and have questions about the findings.',
  'I need to schedule a follow-up appointment for my recent treatment.'
];

// Generate random date within range
const getRandomDate = (daysBack = 90, daysForward = 30) => {
  const today = new Date();
  const start = new Date(today.getTime() - (daysBack * 24 * 60 * 60 * 1000));
  const end = new Date(today.getTime() + (daysForward * 24 * 60 * 60 * 1000));
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// Generate random time
const getRandomTime = () => {
  const hours = 9 + Math.floor(Math.random() * 10); // 9 AM to 6 PM
  const minutes = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

// Generate random email
const generateEmail = (firstName, lastName) => {
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  // Remove spaces and special characters from names
  const cleanFirstName = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const cleanLastName = lastName.toLowerCase().replace(/[^a-z]/g, '');
  return `${cleanFirstName}.${cleanLastName}${Math.floor(Math.random() * 100)}@${domain}`;
};

// Generate random phone
const generatePhone = () => {
  return `09${Math.floor(Math.random() * 900000000) + 100000000}`;
};

// Seed Patients
const seedPatients = async () => {
  console.log('Seeding patients...');
  const patients = [];

  for (let i = 0; i < 25; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const middleName = Math.random() > 0.3 ? middleNames[Math.floor(Math.random() * middleNames.length)] : '';
    
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - (18 + Math.floor(Math.random() * 50))); // Age 18-68
    
    const patient = new Patient({
      firstName,
      middleName,
      lastName,
      birthDate,
      age: new Date().getFullYear() - birthDate.getFullYear(),
      gender: Math.random() > 0.5 ? 'Male' : 'Female',
      contactNumber: generatePhone(),
      email: generateEmail(firstName, lastName),
      address: {
        street: `${Math.floor(Math.random() * 999) + 1} ${streets[Math.floor(Math.random() * streets.length)]}`,
        city: cities[Math.floor(Math.random() * cities.length)],
        province: 'Zambales',
        postalCode: `${2200 + Math.floor(Math.random() * 50)}`
      },
      emergencyContact: {
        name: `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
        relationship: Math.random() > 0.5 ? 'Parent' : 'Spouse',
        contactNumber: generatePhone()
      },
      allergies: Math.random() > 0.7 ? 'Penicillin' : Math.random() > 0.5 ? 'None' : 'Latex',
      registrationDate: getRandomDate(180, -30),
      lastVisit: getRandomDate(30, -1),
      isActive: Math.random() > 0.1 // 90% active patients
    });

    // Add some cases for some patients
    if (Math.random() > 0.6) {
      patient.cases.push({
        title: appointmentTitles[Math.floor(Math.random() * appointmentTitles.length)],
        description: 'Dental treatment case',
        treatmentPlan: 'Standard dental care protocol',
        startDate: getRandomDate(60, -10),
        endDate: Math.random() > 0.7 ? getRandomDate(10, 30) : undefined,
        status: Math.random() > 0.3 ? 'Active' : 'Completed',
        notes: []
      });
    }

    patients.push(patient);
  }

  await Patient.insertMany(patients);
  console.log(`✅ Created ${patients.length} patients`);
  return patients;
};

// Seed Appointments
const seedAppointments = async (patients) => {
  console.log('Seeding appointments...');
  const appointments = [];
  const statuses = ['Scheduled', 'Finished', 'Rescheduled', 'Cancelled', 'Pending'];
  const statusWeights = [0.35, 0.4, 0.1, 0.1, 0.05]; // Higher chance for Finished to show treated patients

  // Create 80-120 appointments
  const appointmentCount = 80 + Math.floor(Math.random() * 41);

  for (let i = 0; i < appointmentCount; i++) {
    const patient = patients[Math.floor(Math.random() * patients.length)];
    const appointmentDate = getRandomDate(90, 60);
    const startTime = getRandomTime();
    const startHour = parseInt(startTime.split(':')[0]);
    const startMinute = parseInt(startTime.split(':')[1]);
    
    // End time is 30-60 minutes later
    const duration = 30 + Math.floor(Math.random() * 31); // 30-60 minutes
    const endHour = Math.floor((startHour * 60 + startMinute + duration) / 60);
    const endMinute = (startHour * 60 + startMinute + duration) % 60;
    const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

    // Weighted random status selection
    let randomValue = Math.random();
    let status = 'Scheduled';
    let cumulative = 0;
    for (let j = 0; j < statusWeights.length; j++) {
      cumulative += statusWeights[j];
      if (randomValue <= cumulative) {
        status = statuses[j];
        break;
      }
    }

    const appointment = new Appointment({
      patient: patient._id,
      date: appointmentDate,
      startTime,
      endTime,
      status,
      title: appointmentTitles[Math.floor(Math.random() * appointmentTitles.length)],
      createdAt: getRandomDate(120, -1),
      updatedAt: getRandomDate(30, -1)
    });

    appointments.push(appointment);
  }

  await Appointment.insertMany(appointments);
  console.log(`✅ Created ${appointments.length} appointments`);
  return appointments;
};

// Seed Inquiries
const seedInquiries = async () => {
  console.log('Seeding inquiries...');
  const inquiries = [];
  const statuses = ['Unread', 'Read', 'Replied'];
  const statusWeights = [0.3, 0.4, 0.3];

  // Create 40-60 inquiries
  const inquiryCount = 40 + Math.floor(Math.random() * 21);

  for (let i = 0; i < inquiryCount; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    
    // Weighted random status selection
    let randomValue = Math.random();
    let status = 'Unread';
    let cumulative = 0;
    for (let j = 0; j < statusWeights.length; j++) {
      cumulative += statusWeights[j];
      if (randomValue <= cumulative) {
        status = statuses[j];
        break;
      }
    }

    const inquiry = new Inquiry({
      fullName: `${firstName} ${lastName}`,
      email: generateEmail(firstName, lastName),
      phone: generatePhone(),
      subject: inquirySubjects[Math.floor(Math.random() * inquirySubjects.length)],
      message: inquiryMessages[Math.floor(Math.random() * inquiryMessages.length)],
      status,
      isArchived: Math.random() > 0.85, // 15% archived
      createdAt: getRandomDate(90, -1),
      updatedAt: getRandomDate(30, -1)
    });

    // Add archive details for archived inquiries
    if (inquiry.isArchived) {
      inquiry.archiveReason = 'Spam inquiry';
      inquiry.archivedAt = getRandomDate(15, -1);
      inquiry.archivedBy = 'Admin';
    }

    inquiries.push(inquiry);
  }

  await Inquiry.insertMany(inquiries);
  console.log(`✅ Created ${inquiries.length} inquiries`);
  return inquiries;
};

// Seed Notes (for treated patients data)
const seedNotes = async (patients, appointments) => {
  console.log('Seeding notes (treatment records)...');
  const notes = [];

  // Get finished appointments for notes
  const finishedAppointments = appointments.filter(apt => apt.status === 'Finished');
  
  for (const appointment of finishedAppointments) {
    // 80% chance to create a note for finished appointment
    if (Math.random() > 0.2) {
      const note = new Notes({
        patient: appointment.patient,
        appointmentId: appointment._id,
        content: `Treatment completed for ${appointment.title}. Patient responded well to treatment.`,
        treatment: appointment.title,
        diagnosis: `Dental condition requiring ${appointment.title.toLowerCase()}`,
        prescription: Math.random() > 0.5 ? 'Prescribed pain medication and antibiotics' : 'No prescription needed',
        payment: {
          amount: 500 + Math.floor(Math.random() * 2000), // ₱500-₱2500
          status: Math.random() > 0.3 ? 'Paid' : 'Pending',
          method: Math.random() > 0.5 ? 'Cash' : 'Credit Card'
        },
        nextAppointment: Math.random() > 0.7 ? getRandomDate(7, 30) : null,
        createdAt: appointment.date,
        updatedAt: appointment.date
      });
      
      notes.push(note);
    }
  }

  // Create some additional notes for ongoing treatments
  const activePatients = patients.filter(p => p.isActive);
  for (let i = 0; i < 20; i++) {
    const patient = activePatients[Math.floor(Math.random() * activePatients.length)];
    const note = new Notes({
      patient: patient._id,
      content: `Regular check-up and cleaning performed. Overall dental health is good.`,
      treatment: 'Dental Cleaning',
      diagnosis: 'Routine maintenance',
      prescription: 'Continue regular oral hygiene',
      payment: {
        amount: 300 + Math.floor(Math.random() * 500), // ₱300-₱800
        status: 'Paid',
        method: Math.random() > 0.5 ? 'Cash' : 'Credit Card'
      },
      nextAppointment: getRandomDate(90, 180),
      createdAt: getRandomDate(60, -1),
      updatedAt: getRandomDate(30, -1)
    });
    
    notes.push(note);
  }

  if (notes.length > 0) {
    await Notes.insertMany(notes);
    console.log(`✅ Created ${notes.length} treatment notes`);
  }
  
  return notes;
};

// Clear existing data
const clearDatabase = async () => {
  console.log('🧹 Clearing existing seed data...');
  await Patient.deleteMany({});
  await Appointment.deleteMany({});
  await Inquiry.deleteMany({});
  
  // Only clear Notes if the model exists
  try {
    await Notes.deleteMany({});
  } catch (error) {
    console.log('Notes model not found, skipping notes cleanup');
  }
  
  console.log('✅ Database cleared');
};

// Main seeding function
const seedDatabase = async () => {
  try {
    await connectDB();
    
    console.log('🌱 Starting database seeding...\n');
    
    // Clear existing data
    await clearDatabase();
    
    // Seed data
    const patients = await seedPatients();
    const appointments = await seedAppointments(patients);
    const inquiries = await seedInquiries();
    
    // Try to seed notes if Notes model exists
    try {
      await seedNotes(patients, appointments);
    } catch (error) {
      console.log('⚠️  Notes model not found, skipping notes seeding');
    }
    
    console.log('\n🎉 Database seeding completed successfully!');
    console.log(`
📊 Summary:
   • ${patients.length} Patients created
   • ${appointments.length} Appointments created  
   • ${inquiries.length} Inquiries created
   • Ready for dashboard testing!
    `);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📝 Database connection closed');
    process.exit(0);
  }
};

// Run the seeder
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
