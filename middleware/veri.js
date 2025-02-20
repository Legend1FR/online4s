const jwt = require("jsonwebtoken");
const Patient = require("../models/patient");
const Admin = require("../models/admin");

const verii = async (req, res, next) => {
    try {
        const token = req.cookies.token; 
        if (!token) {
            return res.status(401).send("الرجاء تسجيل الدخول أولاً");
        }

        const decoded = jwt.verify(token, "fgrpekrfg");
        let user;

        if (decoded.role === "admin") {
            user = await Admin.findOne({ _id: decoded._id });
        } else {
            user = await Patient.findOne({ _id: decoded._id });
        }

        if (!user) {
            return res.status(401).send("المستخدم غير موجود");
        }

        req.user = user; 
        next();
    } catch (error) {
        console.error("Error in verii middleware:", error);
        res.status(500).send("حدث خطأ أثناء التحقق من المستخدم");
    }
};

module.exports = verii;