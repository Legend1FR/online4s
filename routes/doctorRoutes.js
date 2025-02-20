const express = require("express");
const mongoose = require("mongoose");
const doctor = require("./models/doctor.js");
const { name, render } = require("ejs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const veriiii = require("./middleware/veriiii.js");
const cookieParser = require("cookie-parser");
const csrf = require("csurf");
const fs = require("fs");
const nodemailer = require("nodemailer");

const secret = "fgrpekrfg";
const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");
app.use(csrf({ cookie: true }));
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render("error", { message: "حدث خطأ في الخادم" });
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'prot71099@gmail.com',
        pass: 'zywc hzez wvwk vnjn'
    }
});

async function sendVerificationCode(email, code) {
    console.log(`كود التحقق الخاص بك هو:${code}`);
    const mailOptions = {
        from: 'prot71099@gmail.com',
        to: email,
        subject: 'كود التحقق لتأكيد الحساب',
        text: `كود التحقق الخاص بك صالح لمدة 10 دقائق:${code}`
    };

    await transporter.sendMail(mailOptions);
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isStrongPassword(password) {
    const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/;
    return passwordRegex.test(password);
}

app.use((err, req, res, next) => {
    fs.appendFileSync('error.log', `${new Date().toISOString()} - ${err.stack}\n`);
    res.status(500).render("error", { message: "حدث خطأ في الخادم" });
});

app.listen('8001', () => {
    console.log("server is running on port 8001");
});

app.get("/doctor/signUp", (req, res) => {
    res.render("doctor-signup", { error: null, success: null, csrfToken: req.csrfToken() });
});

app.post("/doctor/signUp", async (req, res) => {
    const data = {
        username: req.body.username,
        password: req.body.password,
        email: req.body.email,
        specialization: req.body.specialization,
    };

    if (!data.username || !data.email || !data.password || !data.specialization) {
        return res.render("doctor-signup", { error: "جميع الحقول مطلوبة", success: null, csrfToken: req.csrfToken() });
    }

    if (!isValidEmail(data.email)) {
        return res.render("doctor-signup", { error: "البريد الإلكتروني غير صحيح", success: null, csrfToken: req.csrfToken() });
    }

    if (!isStrongPassword(data.password)) {
        return res.render("doctor-signup", { error: "كلمة المرور يجب أن تحتوي على الأقل على 8 أحرف، حرف كبير، حرف صغير، رقم، وحرف خاص", success: null, csrfToken: req.csrfToken() });
    }

    const existingDoctor = await Doctor.findOne({ username: data.username });

    const existingEmail = await Doctor.findOne({ email: data.email });
    if (existingEmail) {
        return res.render("doctor-signup", { error: "البريد الإلكتروني مسجل مسبقًا", success: null, csrfToken: req.csrfToken() });
    }

    if (existingDoctor) {
        return res.render("doctor-signup", { error: "هذا الحساب موجود بالفعل", success: null, csrfToken: req.csrfToken() });
    } else {
        const numberhash = 10;
        const hashpassword = await bcrypt.hash(data.password, numberhash);
        data.password = hashpassword;

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        data.verificationCode = verificationCode;
        data.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

        const doctorData = await Doctor.create(data);

        await sendVerificationCode(data.email, verificationCode);

        res.render("verify-code", {
            error: null,
            success: "تم إرسال كود التحقق إلى بريدك الإلكتروني",
            csrfToken: req.csrfToken()
        });
    }
});

app.get("/doctor/login", (req, res) => {
    res.render("doctor-login", { error: null, success: null, csrfToken: req.csrfToken() });
});

app.post("/doctor/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const doctor = await Doctor.findOne({ username });
        if (!doctor) {
            return res.status(400).send("اسم المستخدم أو كلمة المرور غير صحيحة");
        }

        const isMatch = await bcrypt.compare(password, doctor.password);
        if (!isMatch) {
            return res.status(400).send("اسم المستخدم أو كلمة المرور غير صحيحة");
        }

        const token = jwt.sign({ _id: doctor._id }, "fgrpekrfg", { expiresIn: "1h" });
        res.cookie("token", token, { httpOnly: true });
        res.redirect("/doctor/dashboard");
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).send("حدث خطأ أثناء تسجيل الدخول");
    }
});

app.get("/doctor/dashboard", veriiii, (req, res) => {
    res.render("doctor-dashboard", { doctor: req.doctor });
});

app.get("/doctor/logout", (req, res) => {
    res.cookie("token", " ", { maxAge: 1 });
    res.redirect("/doctor/login");
});