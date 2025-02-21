


const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const Patient = require("./models/patient.js");
const Admin = require("./models/admin.js");
const Doctor = require("./models/doctor.js");
const Receptionist = require("./models/receptionist.js");  
const { name, render } = require("ejs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const verii = require("./middleware/veri.js");
const cookeparser = require("cookie-parser");
const csrf = require("csurf");
const fs = require("fs");
const nodemailer = require("nodemailer");
const path = require('path');
const exceljs = require('exceljs');
const pdfmake = require('pdfmake');
const multer = require('multer');

const secret = "fgrpekrfg";
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(cookeparser());
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");
app.use(csrf({ cookie: true }));
app.use(express.static('public')); // لخدمة الملفات الثابتة مثل الصور

// إعداد التخزين باستخدام multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './public/images/doctors';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '.png');
    }
});

// فلتر لقبول صيغة PNG فقط
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/png') {
        cb(null, true);
    } else {
        cb(new Error('يجب أن تكون الصورة بصيغة PNG'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // حد أقصى 5 ميجابايت
});

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

server.listen('8000', () => {
    console.log("server is running");
});

app.get("/", async (req, res) => {
    try {
        const token = req.cookies.token;
        if (token) {
            const decoded = jwt.verify(token, "fgrpekrfg");
            const patient = await Patient.findOne({ _id: decoded._id });
            if (patient) {
                res.render("index", { patient: patient, csrfToken: req.csrfToken() });
            } else {
                res.render("index", { patient: null, csrfToken: req.csrfToken() });
            }
        } else {
            res.render("index", { patient: null, csrfToken: req.csrfToken() });
        }
    } catch (error) {
        console.error(error);
        res.render("index", { patient: null, csrfToken: req.csrfToken() });
    }
});
const doctorAuth = async (req, res, next) => {
    try {
        const token = req.cookies.doctor_token;
        if (!token) {
            return res.redirect("/doctor/login");
        }

        const decoded = jwt.verify(token, secret);
        const doctor = await Doctor.findById(decoded._id);
        if (!doctor) {
            return res.redirect("/doctor/login");
        }

        req.doctor = doctor;
        next();
    } catch (error) {
        console.error("Error in doctorAuth middleware:", error);
        res.redirect("/doctor/login");
    }
};
const adminAuth = async (req, res, next) => {
    try {
        const token = req.cookies.admin_token;
        if (!token) {
            return res.redirect("/admin/login");
        }

        const decoded = jwt.verify(token, secret);
        const admin = await Admin.findById(decoded._id);
        if (!admin) {
            return res.redirect("/admin/login");
        }

        req.admin = admin;
        next();
    } catch (error) {
        console.error("Error in adminAuth middleware:", error);
        res.redirect("/admin/login");
    }
};

const receptionistAuth = async (req, res, next) => {
    try {
        const token = req.cookies.receptionist_token;
        if (!token) {
            return res.redirect("/receptionist/login");
        }

        const decoded = jwt.verify(token, secret);
        const receptionist = await Receptionist.findById(decoded._id);
        if (!receptionist) {
            return res.redirect("/receptionist/login");
        }

        req.receptionist = receptionist;
        next();
    } catch (error) {
        console.error("Error in receptionistAuth middleware:", error);
        res.redirect("/receptionist/login");
    }
};


app.post("/admin/update-patient/:id", adminAuth, async (req, res) => {
    const { id } = req.params;
    const { name, email, isVerified } = req.body;

    try {
        if (!name || !email) {
            return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة" });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, message: "البريد الإلكتروني غير صالح" });
        }

        const existingPatient = await Patient.findOne({ 
            email, 
            _id: { $ne: id }
        });
        
        if (existingPatient) {
            return res.status(400).json({ 
                success: false, 
                message: "البريد الإلكتروني مستخدم من قبل مريض آخر" 
            });
        }

        const updatedPatient = await Patient.findByIdAndUpdate(
            id,
            { name, email, isVerified },
            { new: true, runValidators: true }
        );

        if (!updatedPatient) {
            return res.status(404).json({ 
                success: false, 
                message: "لم يتم العثور على المريض" 
            });
        }

        console.log(`تم تحديث معلومات المريض ${id} بواسطة الآدمن ${req.admin._id}`);
        res.json({ 
            success: true, 
            message: "تم تحديث معلومات المريض بنجاح",
            patient: updatedPatient 
        });
    } catch (error) {
        console.error("Error updating patient:", error);
        res.status(500).json({ 
            success: false, 
            message: "حدث خطأ أثناء تحديث معلومات المريض" 
        });
    }
});

app.get("/admin/patients-management", adminAuth, async (req, res) => {
    try {
        const { sort } = req.query;

        let patients;
        if (sort === "newest") {
            patients = await Patient.find({}).sort({ createdAt: -1 });
        } else if (sort === "verified") {
            patients = await Patient.find({ isVerified: true });
        } else if (sort === "unverified") {
            patients = await Patient.find({ isVerified: false });
        } else {
            patients = await Patient.find({});
        }

        res.render("patients-management", {
            patients: patients,
            searchQuery: req.query.search || "",
            admin: req.admin,
            currentPage: 1,
            hasNextPage: false,
            onlinePatients: Array.from(onlinePatients),
            sort: sort || "default",
            csrfToken: req.csrfToken()
        });
    } catch (error) {
        console.error("Error fetching patients:", error);
        res.status(500).render("error", { message: "حدث خطأ أثناء جلب بيانات المرضى" });
    }
});

app.get("/admin/export-patients/excel", adminAuth, async (req, res) => {
    try {
        const patients = await Patient.find({});

        const workbook = new exceljs.Workbook();
        const worksheet = workbook.addWorksheet('Patients');
        worksheet.addRow(['ID', 'Name', 'Email', 'Verified', 'Active']);

        patients.forEach(patient => {
            worksheet.addRow([patient._id, patient.name, patient.email, patient.isVerified, patient.isActive]);
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=patients.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Error exporting to Excel:", error);
        res.status(500).send("حدث خطأ أثناء تصدير البيانات إلى Excel");
    }
});

app.get("/admin/doctors-management", adminAuth, async (req, res) => {
    try {
        const { sort } = req.query;

        let doctors;
        if (sort === "newest") {
            doctors = await Doctor.find({}).sort({ createdAt: -1 });
        } else if (sort === "verified") {
            doctors = await Doctor.find({ isVerified: true });
        } else if (sort === "unverified") {
            doctors = await Doctor.find({ isVerified: false });
        } else {
            doctors = await Doctor.find({});
        }

        res.render("doctors-management", {
            doctors: doctors,
            searchQuery: req.query.search || "",
            admin: req.admin,
            currentPage: 1,
            hasNextPage: false,
            sort: sort || "default",
            csrfToken: req.csrfToken()
        });
    } catch (error) {
        console.error("Error fetching doctors:", error);
        res.status(500).render("error", { message: "حدث خطأ أثناء جلب بيانات الأطباء" });
    }
});

app.get("/admin/export-doctors/excel", adminAuth, async (req, res) => {
    try {
        const doctors = await Doctor.find({});

        const workbook = new exceljs.Workbook();
        const worksheet = workbook.addWorksheet('Doctors');
        worksheet.addRow(['ID', 'Name', 'Email', 'Specialization', 'Verified', 'Active']);

        doctors.forEach(doctor => {
            worksheet.addRow([doctor._id, doctor.username, doctor.email, doctor.specialization, doctor.isVerified, doctor.isActive]);
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=doctors.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Error exporting to Excel:", error);
        res.status(500).send("حدث خطأ أثناء تصدير البيانات إلى Excel");
    }
});

app.get("/admin/delete-doctor/:id", adminAuth, async (req, res) => {
    try {
        await Doctor.findByIdAndDelete(req.params.id);
        res.redirect("/admin/doctors-management");
    } catch (error) {
        console.error("Error deleting doctor:", error);
        res.status(500).send("حدث خطأ أثناء حذف الطبيب");
    }
});

app.post("/admin/update-doctor/:id", adminAuth, async (req, res) => {
    const { id } = req.params;
    const { username, email, specialization, isVerified } = req.body;

    try {
        if (!username || !email || !specialization) {
            return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة" });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, message: "البريد الإلكتروني غير صالح" });
        }

        const existingDoctor = await Doctor.findOne({ 
            email, 
            _id: { $ne: id } 
        });

        if (existingDoctor) {
            return res.status(400).json({ 
                success: false, 
                message: "البريد الإلكتروني مستخدم من قبل طبيب آخر" 
            });
        }

        const updatedDoctor = await Doctor.findByIdAndUpdate(
            id,
            { username, email, specialization, isVerified },
            { new: true, runValidators: true }
        );

        if (!updatedDoctor) {
            return res.status(404).json({ 
                success: false, 
                message: "لم يتم العثور على الطبيب" 
            });
        }

        console.log(`تم تحديث معلومات الطبيب ${id} بواسطة الآدمن ${req.admin._id}`);
        res.json({ 
            success: true, 
            message: "تم تحديث معلومات الطبيب بنجاح",
            doctor: updatedDoctor 
        });
    } catch (error) {
        console.error("Error updating doctor:", error);
        res.status(500).json({ 
            success: false, 
            message: "حدث خطأ أثناء تحديث معلومات الطبيب" 
        });
    }
});

app.post("/admin/add-doctor", adminAuth, upload.single('profileImage'), async (req, res) => {
    const { username, email, password, specialization } = req.body;

    try {
        if (!username || !email || !password || !specialization || !req.file) {
            return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة" });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, message: "البريد الإلكتروني غير صالح" });
        }

        if (!isStrongPassword(password)) {
            return res.status(400).json({ success: false, message: "كلمة المرور يجب أن تحتوي على الأقل على 8 أحرف، حرف كبير، حرف صغير، رقم، وحرف خاص" });
        }

        const existingDoctor = await Doctor.findOne({ email });
        if (existingDoctor) {
            return res.status(400).json({ success: false, message: "البريد الإلكتروني مستخدم بالفعل" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const profileImagePath = `/images/doctors/${req.file.filename}`;

        const newDoctor = new Doctor({
            username,
            email,
            password: hashedPassword,
            specialization,
            profileImage: profileImagePath,
            isVerified: false,
            isActive: true
        });

        await newDoctor.save();

        res.json({ success: true, message: "تم إضافة الطبيب بنجاح" });
    } catch (error) {
        console.error("Error adding doctor:", error);
        res.status(500).json({ success: false, message: "حدث خطأ أثناء إضافة الطبيب" });
    }
});

app.get("/admin/receptionists-management", adminAuth, async (req, res) => {
    try {
        const { sort } = req.query;
        let receptionists;

        if (sort === "newest") {
            receptionists = await Receptionist.find({}).sort({ createdAt: -1 });
        } else {
            receptionists = await Receptionist.find({});
        }

        res.render("receptionists-management", {
            receptionists: receptionists,
            searchQuery: req.query.search || "",
            admin: req.admin,
            currentPage: 1,
            hasNextPage: false,
            sort: sort || "default",
            csrfToken: req.csrfToken()
        });
    } catch (error) {
        console.error("Error fetching receptionists:", error);
        res.status(500).render("error", { message: "حدث خطأ أثناء جلب بيانات موظفي الاستقبال" });
    }
});

app.get("/admin/delete-receptionist/:id", adminAuth, async (req, res) => {
    try {
        await Receptionist.findByIdAndDelete(req.params.id);
        res.redirect("/admin/receptionists-management");
    } catch (error) {
        console.error("Error deleting receptionist:", error);
        res.status(500).send("حدث خطأ أثناء حذف موظف الاستقبال");
    }
});

app.post("/admin/add-receptionist", adminAuth, async (req, res) => {
    const { username, email, password } = req.body;

    try {
        if (!username || !email || !password) {
            return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة" });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, message: "البريد الإلكتروني غير صالح" });
        }

        if (!isStrongPassword(password)) {
            return res.status(400).json({ success: false, message: "كلمة المرور يجب أن تحتوي على الأقل على 8 أحرف، حرف كبير، حرف صغير، رقم، وحرف خاص" });
        }

        const existingReceptionist = await Receptionist.findOne({ $or: [{ username }, { email }] });
        if (existingReceptionist) {
            return res.status(400).json({ success: false, message: "اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newReceptionist = new Receptionist({
            username,
            email,
            password: hashedPassword,
            isFrozen: false
        });

        await newReceptionist.save();
        console.log(`Receptionist ${username} added successfully by admin ${req.admin._id}`);
        res.json({ success: true, message: "تم إضافة موظف الاستقبال بنجاح" });
    } catch (error) {
        console.error("Error adding receptionist:", error);
        res.status(500).json({ success: false, message: "حدث خطأ أثناء إضافة موظف الاستقبال" });
    }
});

app.post("/admin/update-receptionist/:id", adminAuth, async (req, res) => {
    const { id } = req.params;
    const { username, email } = req.body;

    try {
        if (!username || !email) {
            return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة" });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, message: "البريد الإلكتروني غير صالح" });
        }

        const existingReceptionist = await Receptionist.findOne({ $or: [{ username }, { email }], _id: { $ne: id } });
        if (existingReceptionist) {
            return res.status(400).json({ success: false, message: "اسم المستخدم أو البريد الإلكتروني مستخدم من قبل موظف آخر" });
        }

        const updatedReceptionist = await Receptionist.findByIdAndUpdate(
            id,
            { username, email },
            { new: true, runValidators: true }
        );

        if (!updatedReceptionist) {
            return res.status(404).json({ success: false, message: "لم يتم العثور على موظف الاستقبال" });
        }

        console.log(`Receptionist ${id} updated by admin ${req.admin._id}`);
        res.json({ success: true, message: "تم تحديث معلومات موظف الاستقبال بنجاح", receptionist: updatedReceptionist });
    } catch (error) {
        console.error("Error updating receptionist:", error);
        res.status(500).json({ success: false, message: "حدث خطأ أثناء تحديث معلومات موظف الاستقبال" });
    }
});

app.post("/admin/freeze-receptionist/:id", adminAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const receptionist = await Receptionist.findById(id);
        if (!receptionist) {
            return res.status(404).json({ success: false, message: "لم يتم العثور على موظف الاستقبال" });
        }

        receptionist.isFrozen = true;
        await receptionist.save();

        const mailOptions = {
            from: 'prot71099@gmail.com',
            to: receptionist.email,
            subject: 'تم تجميد حسابك',
            text: 'تم تجميد حسابك في موقعنا. يرجى الاتصال بالإدارة لمزيد من المعلومات.'
        };
        await transporter.sendMail(mailOptions);

        console.log(`Receptionist ${id} frozen by admin ${req.admin._id}`);
        res.json({ success: true, message: "تم تجميد حساب موظف الاستقبال بنجاح" });
    } catch (error) {
        console.error("Error freezing receptionist:", error);
        res.status(500).json({ success: false, message: "حدث خطأ أثناء تجميد حساب موظف الاستقبال" });
    }
});

app.post("/admin/unfreeze-receptionist/:id", adminAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const receptionist = await Receptionist.findById(id);
        if (!receptionist) {
            return res.status(404).json({ success: false, message: "لم يتم العثور على موظف الاستقبال" });
        }

        receptionist.isFrozen = false;
        await receptionist.save();

        console.log(`Receptionist ${id} unfrozen by admin ${req.admin._id}`);
        res.json({ success: true, message: "تم إلغاء تجميد حساب موظف الاستقبال بنجاح" });
    } catch (error) {
        console.error("Error unfreezing receptionist:", error);
        res.status(500).json({ success: false, message: "حدث خطأ أثناء إلغاء تجميد حساب موظف الاستقبال" });
    }
});

app.post("/admin/send-message-receptionist", adminAuth, async (req, res) => {
    const { receptionistId, receptionistEmail, messageContent } = req.body;

    try {
        if (!receptionistId || !receptionistEmail || !messageContent) {
            return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة" });
        }

        const receptionist = await Receptionist.findById(receptionistId);
        if (!receptionist) {
            return res.status(404).json({ success: false, message: "لم يتم العثور على موظف الاستقبال" });
        }

        const mailOptions = {
            from: 'prot71099@gmail.com',
            to: receptionistEmail,
            subject: 'رسالة من إدارة النظام',
            text: messageContent
        };
        await transporter.sendMail(mailOptions);

        console.log(`Message sent to receptionist ${receptionistId} by admin ${req.admin._id}`);
        res.json({ success: true, message: "تم إرسال الرسالة بنجاح" });
    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ success: false, message: "حدث خطأ أثناء إرسال الرسالة" });
    }
});

app.get("/admin/export-receptionists/excel", adminAuth, async (req, res) => {
    try {
        const receptionists = await Receptionist.find({});

        const workbook = new exceljs.Workbook();
        const worksheet = workbook.addWorksheet('Receptionists');
        worksheet.addRow(['ID', 'Username', 'Email', 'Frozen']);

        receptionists.forEach(receptionist => {
            worksheet.addRow([receptionist._id, receptionist.username, receptionist.email, receptionist.isFrozen]);
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=receptionists.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Error exporting to Excel:", error);
        res.status(500).send("حدث خطأ أثناء تصدير البيانات إلى Excel");
    }
});

app.post("/admin/freeze-doctor/:id", adminAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const doctor = await Doctor.findById(id);
        if (!doctor) {
            return res.status(404).json({ success: false, message: "لم يتم العثور على الطبيب" });
        }

        doctor.isFrozen = true;
        await doctor.save();

        const mailOptions = {
            from: 'prot71099@gmail.com',
            to: doctor.email,
            subject: 'تم تجميد حسابك',
            text: 'تم تجميد حسابك في موقعنا. يرجى الاتصال بالإدارة لمزيد من المعلومات.'
        };
        await transporter.sendMail(mailOptions);

        res.json({ success: true, message: "تم تجميد حساب الطبيب بنجاح" });
    } catch (error) {
        console.error("Error freezing doctor:", error);
        res.status(500).json({ success: false, message: "حدث خطأ أثناء تجميد حساب الطبيب" });
    }
});

app.post("/admin/unfreeze-doctor/:id", adminAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const doctor = await Doctor.findById(id);
        if (!doctor) {
            return res.status(404).json({ success: false, message: "لم يتم العثور على الطبيب" });
        }

        doctor.isFrozen = false;
        await doctor.save();

        res.json({ success: true, message: "تم إلغاء تجميد حساب الطبيب بنجاح" });
    } catch (error) {
        console.error("Error unfreezing doctor:", error);
        res.status(500).json({ success: false, message: "حدث خطأ أثناء إلغاء تجميد حساب الطبيب" });
    }
});

app.get("/admin/delete-patient/:id", adminAuth, async (req, res) => {
    try {
        await Patient.findByIdAndDelete(req.params.id);
        res.redirect("/admin/patients-management");
    } catch (error) {
        console.error("Error deleting patient:", error);
        res.status(500).send("حدث خطأ أثناء حذف المريض");
    }
});


const onlinePatients = new Set();

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("patientOnline", (patientId) => {
        onlinePatients.add(patientId);
        io.emit("updatePatientStatus", { patientId, status: "online" }); 
    });

    socket.on("patientOffline", (patientId) => {
        onlinePatients.delete(patientId);
        io.emit("updatePatientStatus", { patientId, status: "offline" }); 
    });

    socket.on("disconnect", () => {
        console.log("A user disconnected:", socket.id);
        onlinePatients.forEach((patientId) => {
            if (onlinePatients.has(patientId)) {
                onlinePatients.delete(patientId);
                io.emit("updatePatientStatus", { patientId, status: "offline" });
            }
        });
    });
});

app.post("/admin/add-patient", adminAuth, async (req, res) => {
    const { name, email, password } = req.body;

    try {
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة" });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, message: "البريد الإلكتروني غير صالح" });
        }

        if (!isStrongPassword(password)) {
            return res.status(400).json({ success: false, message: "كلمة المرور يجب أن تحتوي على الأقل على 8 أحرف، حرف كبير، حرف صغير، رقم، وحرف خاص" });
        }

        const existingPatient = await Patient.findOne({ email });
        if (existingPatient) {
            return res.status(400).json({ success: false, message: "البريد الإلكتروني مستخدم بالفعل" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newPatient = new Patient({
            name,
            email,
            password: hashedPassword,
            isVerified: false,
            isActive: true
        });

        await newPatient.save();
        res.json({ success: true, message: "تم إضافة المريض بنجاح" });
    } catch (error) {
        console.error("Error adding patient:", error);
        res.status(500).json({ success: false, message: "حدث خطأ أثناء إضافة المريض" });
    }
});

app.post("/admin/send-message", adminAuth, async (req, res) => {
    const { patientId, patientEmail, messageContent } = req.body;

    try {
        if (!patientId || !patientEmail || !messageContent) {
            return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة" });
        }

        const mailOptions = {
            from: 'prot71099@gmail.com',
            to: patientEmail,
            subject: 'رسالة من إدارة النظام',
            text: messageContent
        };
        await transporter.sendMail(mailOptions);

        res.json({ success: true, message: "تم إرسال الرسالة بنجاح" });
    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ success: false, message: "حدث خطأ أثناء إرسال الرسالة" });
    }
});



app.get("/doctor/login", (req, res) => {
    res.render("doctor-login", { error: null, csrfToken: req.csrfToken() });
});

app.post("/doctor/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const doctor = await Doctor.findOne({ username });
        if (!doctor) {
            return res.render("doctor-login", { error: "اسم المستخدم أو كلمة المرور غير صحيحة", csrfToken: req.csrfToken() });
        }

        const isMatch = await bcrypt.compare(password, doctor.password);
        if (!isMatch) {
            return res.render("doctor-login", { error: "اسم المستخدم أو كلمة المرور غير صحيحة", csrfToken: req.csrfToken() });
        }

        const token = jwt.sign({ _id: doctor._id, role: "doctor" }, secret, { expiresIn: "1h" });
        res.cookie("doctor_token", token, { httpOnly: true });
        res.redirect("/doctor/dashboard");
    } catch (error) {
        console.error("Error during doctor login:", error);
        res.status(500).send("حدث خطأ أثناء تسجيل الدخول");
    }
});



app.get("/doctor/dashboard", doctorAuth, (req, res) => {
    res.render("doctor-dashboard", { doctor: req.doctor });
});

app.get("/doctor/logout", (req, res) => {
    res.cookie("doctor_token", " ", { maxAge: 1 });
    res.redirect("/doctor/login");
});

app.get("/receptionist/login", (req, res) => {
    res.render("receptionist-login", { error: null, csrfToken: req.csrfToken() });
});

app.post("/receptionist/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const receptionist = await Receptionist.findOne({ username });
        if (!receptionist) {
            return res.render("receptionist-login", { error: "اسم المستخدم أو كلمة المرور غير صحيحة", csrfToken: req.csrfToken() });
        }

        const isMatch = await bcrypt.compare(password, receptionist.password);
        if (!isMatch) {
            return res.render("receptionist-login", { error: "اسم المستخدم أو كلمة المرور غير صحيحة", csrfToken: req.csrfToken() });
        }

        const token = jwt.sign({ _id: receptionist._id, role: "receptionist" }, secret, { expiresIn: "1h" });
        res.cookie("receptionist_token", token, { httpOnly: true });
        res.redirect("/receptionist/dashboard");
    } catch (error) {
        console.error("Error during receptionist login:", error);
        res.status(500).send("حدث خطأ أثناء تسجيل الدخول");
    }
});

app.get("/receptionist/dashboard", receptionistAuth, (req, res) => {
    res.render("receptionist-dashboard", { receptionist: req.receptionist });
});

app.get("/receptionist/logout", (req, res) => {
    res.cookie("receptionist_token", " ", { maxAge: 1 });
    res.redirect("/receptionist/login");
});

app.get("/admin/login", (req, res) => {
    res.render("admin-login", { error: null, csrfToken: req.csrfToken() });
});
app.post("/admin/login", async (req, res) => {
    const { username, password, 'g-recaptcha-response': recaptchaResponse } = req.body;

    // Verify reCAPTCHA
    const secretKey = '6Lfr_t0qAAAAANDedul8N5AldRwzakiejic0d0V1';
    const verificationURL = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaResponse}`;

    try {
        const response = await axios.post(verificationURL);
        if (!response.data.success) {
            return res.render("admin-login", { error: "التحقق من reCAPTCHA فشل. حاول مرة أخرى.", csrfToken: req.csrfToken() });
        }

        const admin = await Admin.findOne({ username });
        if (!admin) {
            return res.render("admin-login", { error: "اسم المستخدم أو كلمة المرور غير صحيحة", csrfToken: req.csrfToken() });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.render("admin-login", { error: "اسم المستخدم أو كلمة المرور غير صحيحة", csrfToken: req.csrfToken() });
        }

        const token = jwt.sign({ _id: admin._id, role: "admin" }, secret, { expiresIn: "1h" });
        res.cookie("admin_token", token, { httpOnly: true });
        res.redirect("/admin/dashboard");
    } catch (error) {
        console.error("Error during admin login:", error);
        res.status(500).send("حدث خطأ أثناء تسجيل الدخول");
    }
});

app.get("/admin/dashboard", adminAuth, (req, res) => {
    res.render("admin-dashboard", { admin: req.admin });
});

app.get("/admin/logout", (req, res) => {
    res.cookie("admin_token", " ", { maxAge: 1 });
    res.redirect("/admin/login");
});

app.get("/signUp", (req, res) => {
    res.render("signUp", { error: null, success: null, csrfToken: req.csrfToken() });
});

app.post("/signUp", async (req, res) => {
    const data = {
        name: req.body.name,
        password: req.body.password,
        email: req.body.email,
    };

    if (!data.name || !data.email || !data.password) {
        return res.render("signUp", { error: "جميع الحقول مطلوبة", success: null, csrfToken: req.csrfToken() });
    }

    if (!isValidEmail(data.email)) {
        return res.render("signUp", { error: "البريد الإلكتروني غير صحيح", success: null, csrfToken: req.csrfToken() });
    }

    if (!isStrongPassword(data.password)) {
        return res.render("signUp", { error: "كلمة المرور يجب أن تحتوي على الأقل على 8 أحرف، حرف كبير، حرف صغير، رقم، وحرف خاص", success: null, csrfToken: req.csrfToken() });
    }

    const existingPatient = await Patient.findOne({ name: data.name });
    const existingEmail = await Patient.findOne({ email: data.email });
    if (existingEmail) {
        return res.render("signUp", { error: "البريد الإلكتروني مسجل مسبقًا", success: null, csrfToken: req.csrfToken() });
    }

    if (existingPatient) {
        return res.render("signUp", { error: "هذا الحساب موجود بالفعل", success: null, csrfToken: req.csrfToken() });
    } else {
        const numberhash = 10;
        const hashpassword = await bcrypt.hash(data.password, numberhash);
        data.password = hashpassword;

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        data.verificationCode = verificationCode;
        data.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

        const patientData = await Patient.create(data);
        await sendVerificationCode(data.email, verificationCode);

        res.render("verify-code", {
            error: null,
            success: "تم إرسال كود التحقق إلى بريدك الإلكتروني",
            csrfToken: req.csrfToken()
        });
    }
});

app.get("/verify-account", (req, res) => {
    res.render("verify-code", { error: null, success: null, csrfToken: req.csrfToken() });
});

app.post("/verify-account", async (req, res) => {
    const code = req.body.code;
    try {
        const patient = await Patient.findOne({
            verificationCode: code,
            verificationCodeExpires: { $gt: Date.now() } 
        });

        if (!patient) {
            return res.render("verify-code", {
                error: "كود التحقق غير صحيح أو انتهت صلاحيته",
                success: null,
                csrfToken: req.csrfToken()
            });
        }
        res.redirect(`/update-password/${patient._id}`);
    } catch (error) {
        console.error(error);
        res.render("verify-code", {
            error: "حدث خطأ أثناء التحقق من الكود",
            success: null,
            csrfToken: req.csrfToken()
        });
    }
});

app.get("/login", (req, res) => {
    res.render("login", { error: null, success: null, csrfToken: req.csrfToken() });
});

app.post("/login", async (req, res) => {
    const { name, password } = req.body;
    try {
        const patient = await Patient.findOne({ name });
        if (!patient) {
            return res.status(400).send("اسم المستخدم أو كلمة المرور غير صحيحة");
        }

        if (patient.isFrozen) {
            return res.status(400).send("حسابك مجمد. يرجى الاتصال بالإدارة.");
        }

        const isMatch = await bcrypt.compare(password, patient.password);
        if (!isMatch) {
            return res.status(400).send("اسم المستخدم أو كلمة المرور غير صحيحة");
        }

        const token = jwt.sign({ _id: patient._id }, "fgrpekrfg", { expiresIn: "1h" });
        res.cookie("token", token, { httpOnly: true });
        res.redirect("/");
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).send("حدث خطأ أثناء تسجيل الدخول");
    }
});

app.post("/admin/freeze-patient/:id", adminAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const patient = await Patient.findById(id);
        if (!patient) {
            return res.status(404).json({ success: false, message: "لم يتم العثور على المريض" });
        }

        patient.isFrozen = true;
        await patient.save();

        const mailOptions = {
            from: 'prot71099@gmail.com',
            to: patient.email,
            subject: 'تم تجميد حسابك',
            text: 'تم تجميد حسابك في موقعنا. يرجى الاتصال بالإدارة لمزيد من المعلومات.'
        };
        await transporter.sendMail(mailOptions);

        res.json({ success: true, message: "تم تجميد حساب المريض بنجاح" });
    } catch (error) {
        console.error("Error freezing patient:", error);
        res.status(500).json({ success: false, message: "حدث خطأ أثناء تجميد حساب المريض" });
    }
});

app.post("/admin/unfreeze-patient/:id", adminAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const patient = await Patient.findById(id);
        if (!patient) {
            return res.status(404).json({ success: false, message: "لم يتم العثور على المريض" });
        }

        patient.isFrozen = false;
        await patient.save();

        res.json({ success: true, message: "تم إلغاء تجميد حساب المريض بنجاح" });
    } catch (error) {
        console.error("Error unfreezing patient:", error);
        res.status(500).json({ success: false, message: "حدث خطأ أثناء إلغاء تجميد حساب المريض" });
    }
});

app.post("/admin/send-message-doctor", adminAuth, async (req, res) => {
    const { doctorId, doctorEmail, messageContent } = req.body;

    try {
        if (!doctorId || !doctorEmail || !messageContent) {
            return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة" });
        }

        const mailOptions = {
            from: 'prot71099@gmail.com',
            to: doctorEmail,
            subject: 'رسالة من إدارة النظام',
            text: messageContent
        };
        await transporter.sendMail(mailOptions);

        res.json({ success: true, message: "تم إرسال الرسالة بنجاح" });
    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ success: false, message: "حدث خطأ أثناء إرسال الرسالة" });
    }
});

app.get("/reset-password", (req, res) => {
    res.render("reset-password", { error: null, success: null, csrfToken: req.csrfToken() });
});

app.post("/reset-password", async (req, res) => {
    const email = req.body.email;
    try {
        const patient = await Patient.findOne({ email: email });
        if (!patient) {
            return res.render("reset-password", {
                error: "البريد الإلكتروني غير مسجل",
                success: null,
                csrfToken: req.csrfToken()
            });
        }

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        patient.verificationCode = verificationCode;
        patient.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
        await patient.save();

        await sendVerificationCode(email, verificationCode);

        res.render("verify-code", {
            error: null,
            success: "تم إرسال كود التحقق إلى بريدك الإلكتروني",
            csrfToken: req.csrfToken()
        });
    } catch (error) {
        console.error(error);
        res.render("reset-password", {
            error: "حدث خطأ أثناء محاولة إعادة تعيين كلمة المرور",
            success: null,
            csrfToken: req.csrfToken()
        });
    }
});

app.get("/verify-code", (req, res) => {
    res.render("verify-code", { error: null, success: null, csrfToken: req.csrfToken() });
});

app.post("/verify-code", async (req, res) => {
    const code = req.body.code;
    try {
        const patient = await Patient.findOne({
            verificationCode: code,
            verificationCodeExpires: { $gt: Date.now() }
        });

        if (!patient) {
            return res.render("verify-code", {
                error: "كود التحقق غير صحيح",
                success: null,
                csrfToken: req.csrfToken()
            });
        }
        res.redirect(`/update-password/${patient._id}`);
    } catch (error) {
        console.error(error);
        res.render("verify-code", {
            error: "حدث خطأ أثناء التحقق من الكود",
            success: null,
            csrfToken: req.csrfToken()
        });
    }
});

app.get("/update-password/:patientId", (req, res) => {
    res.render("update-password", { patientId: req.params.patientId, error: null, csrfToken: req.csrfToken() });
});

app.post("/update-password/:patientId", async (req, res) => {
    const newPassword = req.body.newPassword;
    const patientId = req.params.patientId;

    try {
        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.render("update-password", {
                patientId,
                error: "المريض غير موجود",
                csrfToken: req.csrfToken()
            });
        }

        if (!isStrongPassword(newPassword)) {
            return res.render("update-password", {
                patientId,
                error: "كلمة المرور يجب أن تحتوي على الأقل على 8 أحرف، حرف كبير، حرف صغير، رقم، وحرف خاص",
                csrfToken: req.csrfToken()
            });
        }

        const hashpassword = await bcrypt.hash(newPassword, 10);
        patient.password = hashpassword;
        patient.verificationCode = null;
        await patient.save();

        res.redirect("/login?success=تم تحديث كلمة المرور بنجاح");
    } catch (error) {
        console.error(error);
        res.render("update-password", {
            patientId,
            error: "حدث خطأ أثناء تحديث كلمة المرور",
            csrfToken: req.csrfToken()
        });
    }
});

app.get("/logout", (req, res) => {
    res.cookie("token", " ", { maxAge: 1 });
    res.redirect("/");
});

app.get("/request-session", verii, async (req, res) => {
    try {
        const token = req.cookies.token;
        if (token) {
            const decoded = jwt.verify(token, "fgrpekrfg");
            const patient = await Patient.findOne({ _id: decoded._id });
            if (patient) {
                const specialization = req.query.specialization;
                let doctors;
                if (specialization && specialization !== 'all') {
                    doctors = await Doctor.find({ specialization: specialization });
                } else {
                    doctors = await Doctor.find({});
                }
                res.render("doctor-list", { 
                    patient: patient, 
                    doctors: doctors, 
                    csrfToken: req.csrfToken() 
                });
            } else {
                res.render("doctor-list", { 
                    patient: null, 
                    doctors: [], 
                    csrfToken: req.csrfToken() 
                });
            }
        } else {
            res.render("doctor-list", { 
                patient: null, 
                doctors: [], 
                csrfToken: req.csrfToken() 
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("حدث خطأ أثناء جلب بيانات المريض");
    }
});


