// This file contains the logic for handling patient-related requests.

const Patient = require('../models/Patient'); // Assuming you have a Patient model defined

exports.getPatientProfile = async (req, res) => {
    try {
        const patientId = req.session.patientId; // Assuming patient ID is stored in session
        const patient = await Patient.findById(patientId); // Fetch patient information from the database

        if (!patient) {
            return res.status(404).render('error', { message: 'Patient not found' });
        }

        res.render('profile', { patient }); // Render the profile view with patient data
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { message: 'Internal Server Error' });
    }
};