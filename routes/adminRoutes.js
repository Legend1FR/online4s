const express = require("express");
const router = express.Router();
const Admin = require("../models/admin");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const veriii = require("../middleware/veriii.js");
const cookeparser = require("cookie-parser");
const csrf = require("csurf");
const fs = require("fs");
const nodemailer = require("nodemailer");


router.get("/signUp", (req, res) => {
    res.render("admin-signUp", { error: null, success: null, csrfToken: req.csrfToken() });
});

router.post("/signUp", async (req, res) => {
    const data = {
        username: req.body.username,
        password: req.body.password,
        email: req.body.email,
    };

    if (!data.username || !data.email || !data.password) {
        return res.render("admin-signUp", { error: "جميع الحقول مطلوبة", success: null, csrfToken: req.csrfToken() });
    }

    if (!isValidEmail(data.email)) {
        return res.render("admin-signUp", { error: "البريد الإلكتروني غير صحيح", success: null, csrfToken: req.csrfToken() });
    }

    if (!isStrongPassword(data.password)) {
        return res.render("admin-signUp", { error: "كلمة المرور يجب أن تحتوي على الأقل على 8 أحرف، حرف كبير، حرف صغير، رقم، وحرف خاص", success: null, csrfToken: req.csrfToken() });
    }

    const existingAdmin = await Admin.findOne({ username: data.username });

    const existingEmail = await Admin.findOne({ email: data.email });
    if (existingEmail) {
        return res.render("admin-signUp", { error: "البريد الإلكتروني مسجل مسبقًا", success: null, csrfToken: req.csrfToken() });
    }

    if (existingAdmin) {
        return res.render("admin-signUp", { error: "هذا الحساب موجود بالفعل", success: null, csrfToken: req.csrfToken() });
    } else {
        const numberhash = 10;
        const hashpassword = await bcrypt.hash(data.password, numberhash);
        data.password = hashpassword;

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        data.verificationCode = verificationCode;
        data.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

        const adminData = await Admin.create(data);

        await sendVerificationCode(data.email, verificationCode);

        res.render("verify-code", {
            error: null,
            success: "تم إرسال كود التحقق إلى بريدك الإلكتروني",
            csrfToken: req.csrfToken()
        });
    }
});

router.get("/login", (req, res) => {
    res.render("admin-login", { error: null, success: null, csrfToken: req.csrfToken() });
});

router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const admin = await Admin.findOne({ username });
        if (!admin) {
            return res.status(400).send("اسم المستخدم أو كلمة المرور غير صحيحة");
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(400).send("اسم المستخدم أو كلمة المرور غير صحيحة");
        }

        const token = jwt.sign({ _id: admin._id }, secret, { expiresIn: "1h" });
        res.cookie("token", token, { httpOnly: true });
        res.redirect("/admin/dashboard");
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).send("حدث خطأ أثناء تسجيل الدخول");
    }
});

router.get("/dashboard", veriii, (req, res) => {
    res.render("admin-dashboard", { admin: req.admin });
});

router.get("/logout", (req, res) => {
    res.cookie("token", " ", { maxAge: 1 });
    res.redirect("/admin/login");
});

module.exports = router;