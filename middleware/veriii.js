
const jwt = require("jsonwebtoken");
const Admin = require("../models/admin");

const veriii = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).send("الرجاء تسجيل الدخول أولاً");
        }

        const decoded = jwt.verify(token, "fgrpekrfg");
        const admin = await Admin.findOne({ _id: decoded._id });

        if (!admin) {
            return res.status(401).send("المستخدم غير موجود");
        }

        req.admin = admin;
        next();
    } catch (error) {
        console.error("Error in veriii middleware:", error);
        res.status(500).send("حدث خطأ أثناء التحقق من المستخدم");
    }
};

module.exports = veriii;