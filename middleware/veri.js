const jwt = require("jsonwebtoken");
const Patient = require("../models/patient");


const verii = async (req, res, next) => {
    try {
        const token = req.cookies.token; 
        if (!token) {
            return res.status(401).send("الرجاء تسجيل الدخول أولاً");
        }

        const decoded = jwt.verify(token, "fgrpekrfg");
        const patient = await Patient.findOne({ _id: decoded._id });

        if (!patient) {
            return res.status(401).send("المريض غير موجود");
        }

        req.patient = patient;
        next();
    } catch (error) {
        console.error("Error in verii middleware:", error);
        res.status(500).send("حدث خطأ أثناء التحقق من المريض");
    }
};

module.exports = verii;