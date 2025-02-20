const Patient = require('../models/patient');
const { sendVerificationCode } = require('../utils/emailUtils');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { isValidEmail, isStrongPassword } = require('../utils/validationUtils');

const secret = "fgrpekrfg";

exports.signUp = async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.render("signUp", { error: "جميع الحقول مطلوبة", success: null, csrfToken: req.csrfToken() });
    }

    if (!isValidEmail(email)) {
        return res.render("signUp", { error: "البريد الإلكتروني غير صحيح", success: null, csrfToken: req.csrfToken() });
    }

    if (!isStrongPassword(password)) {
        return res.render("signUp", { error: "كلمة المرور يجب أن تحتوي على الأقل على 8 أحرف، حرف كبير، حرف صغير، رقم، وحرف خاص", success: null, csrfToken: req.csrfToken() });
    }

    const existingPatient = await Patient.findOne({ name });
    const existingEmail = await Patient.findOne({ email });

    if (existingEmail) {
        return res.render("signUp", { error: "البريد الإلكتروني مسجل مسبقًا", success: null, csrfToken: req.csrfToken() });
    }

    if (existingPatient) {
        return res.render("signUp", { error: "هذا الحساب موجود بالفعل", success: null, csrfToken: req.csrfToken() });
    }

    const hashpassword = await bcrypt.hash(password, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const patientData = await Patient.create({
        name,
        email,
        password: hashpassword,
        verificationCode,
        verificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000)
    });

    await sendVerificationCode(email, verificationCode);

    res.render("verify-code", { error: null, success: "تم إرسال كود التحقق إلى بريدك الإلكتروني", csrfToken: req.csrfToken() });
};

exports.verifyAccount = async (req, res) => {
    const { code } = req.body;

    const patient = await Patient.findOne({
        verificationCode: code,
        verificationCodeExpires: { $gt: Date.now() }
    });

    if (!patient) {
        return res.render("verify-code", { error: "كود التحقق غير صحيح أو انتهت صلاحيته", success: null, csrfToken: req.csrfToken() });
    }

    patient.isVerified = true;
    patient.verificationCode = null;
    patient.verificationCodeExpires = null;
    await patient.save();

    res.redirect("/login?success=تم تأكيد الحساب بنجاح");
};

exports.login = async (req, res) => {
    const { name, password } = req.body;

    const patient = await Patient.findOne({ name });

    if (!patient) {
        return res.render("login", { error: "خطأ في اسم المريض أو كلمة المرور", success: null, csrfToken: req.csrfToken() });
    }

    const passwordMatch = await bcrypt.compare(password, patient.password);

    if (!passwordMatch) {
        return res.render("login", { error: "خطأ في اسم المريض أو كلمة المرور", success: null, csrfToken: req.csrfToken() });
    }

    if (!patient.isVerified) {
        return res.render("login", { error: "الرجاء تأكيد حسابك عن طريق البريد الإلكتروني", success: null, csrfToken: req.csrfToken() });
    }

    const token = jwt.sign({ name: patient.name }, secret);
    res.cookie("token", token, { httpOnly: true });

    res.render("login", { error: null, success: "تم تسجيل الدخول بنجاح", csrfToken: req.csrfToken() });
};

exports.resetPassword = async (req, res) => {
    const { email } = req.body;

    const patient = await Patient.findOne({ email });

    if (!patient) {
        return res.render("reset-password", { error: "البريد الإلكتروني غير مسجل", success: null, csrfToken: req.csrfToken() });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    patient.verificationCode = verificationCode;
    patient.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
    await patient.save();

    await sendVerificationCode(email, verificationCode);

    res.render("verify-code", { error: null, success: "تم إرسال كود التحقق إلى بريدك الإلكتروني", csrfToken: req.csrfToken() });
};

exports.updatePassword = async (req, res) => {
    const { newPassword } = req.body;
    const { patientId } = req.params;

    const patient = await Patient.findById(patientId);

    if (!patient) {
        return res.render("update-password", { patientId, error: "المريض غير موجود", csrfToken: req.csrfToken() });
    }

    if (!isStrongPassword(newPassword)) {
        return res.render("update-password", { patientId, error: "كلمة المرور يجب أن تحتوي على الأقل على 8 أحرف، حرف كبير، حرف صغير، رقم، وحرف خاص", csrfToken: req.csrfToken() });
    }

    const hashpassword = await bcrypt.hash(newPassword, 10);
    patient.password = hashpassword;
    patient.verificationCode = null;
    await patient.save();

    res.redirect("/login?success=تم تحديث كلمة المرور بنجاح");
};

exports.logout = (req, res) => {
    res.cookie("token", " ", { maxAge: 1 });
    res.redirect("/");
};