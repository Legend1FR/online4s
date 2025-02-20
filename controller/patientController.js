const Patient = require('../models/patient');

exports.getPatientProfile = async (req, res) => {
    const token = req.cookies.token;

    if (!token) {
        return res.render("index", { patient: null, csrfToken: req.csrfToken() });
    }

    try {
        const decoded = jwt.verify(token, secret);
        const patient = await Patient.findOne({ name: decoded.name });
        res.render("index", { patient, csrfToken: req.csrfToken() });
    } catch (error) {
        res.render("index", { patient: null, csrfToken: req.csrfToken() });
    }
};