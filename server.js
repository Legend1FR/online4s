



// server.js

const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const Patient = require("./models/patient.js");
const Appointment = require("./models/appointment.js");
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
const csrfProtection = csrf({ cookie: true });
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(cookeparser());
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");
app.use(csrf({ cookie: true }));
app.use(express.static('public')); 




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
    limits: { fileSize: 5 * 1024 * 1024 } 
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

// Socket.io Real-time Communication
const activeSessions = new Map();

io.on('connection', (socket) => {
    console.log('New user connected:', socket.id);

    socket.on('joinSession', async ({ sessionId, doctorId, patientId, userType }) => {
        try {
            const session = await Appointment.findById(sessionId)
                .populate('doctor', 'username profileImage')
                .populate('patient', 'name profileImage');

            if (!session) {
                socket.emit('error', { message: 'الجلسة غير موجودة' });
                return;
            }

            if (
                (userType === 'doctor' && session.doctor._id.toString() !== doctorId) ||
                (userType === 'patient' && session.patient._id.toString() !== patientId)
            ) {
                socket.emit('error', { message: 'ليس لديك صلاحية الدخول لهذه الجلسة' });
                return;
            }

            const roomId = `session_${sessionId}`;
            socket.join(roomId);

            if (!activeSessions.has(sessionId)) {
                activeSessions.set(sessionId, { roomId, participants: [] });
            }
            activeSessions.get(sessionId).participants.push(socket.id);

            if (userType === 'doctor') {
                io.to(roomId).emit('sessionStarted', {
                    sessionId,
                    duration: 30 * 60,
                    startTime: new Date()
                });

                io.to(`patient_${patientId}`).emit('sessionReady', {
                    sessionId,
                    doctorName: session.doctor.username,
                    doctorImage: session.doctor.profileImage
                });
            }

            socket.emit('sessionJoined', { roomId });
        } catch (error) {
            console.error('Session join error:', error);
            socket.emit('error', { message: 'حدث خطأ في الاتصال بالجلسة' });
        }
    });

    // بقية معالجات Socket.io كما هي (sendMessage, endSession, disconnect)


  // Handle Messages
  socket.on('sendMessage', ({ sessionId, sender, message }) => {
    const roomId = `session_${sessionId}`;
    io.to(roomId).emit('newMessage', { sender, message, timestamp: new Date() });
  });

  // End Session
  socket.on('endSession', async ({ sessionId }) => {
    const roomId = `session_${sessionId}`;
    io.to(roomId).emit('sessionEnded', { endTime: new Date() });
    activeSessions.delete(sessionId);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Clean up any sessions this socket was part of
    activeSessions.forEach((session, sessionId) => {
      if (session.participants.includes(socket.id)) {
        io.to(session.roomId).emit('participantLeft', { socketId: socket.id });
      }
    });
  });
});


// Doctor Sessions Route
app.get("/doctor/sessions", doctorAuth, async (req, res) => {
    try {
      const sessions = await Appointment.find({
        doctor: req.doctor._id,
        
      }).populate({
        path: 'patient',
        select: 'name profileImage',
        options: { allowNull: true }
      }).sort({ date: 1, time: 1 });
  
      res.render("doctor-sessions", {
        doctor: req.doctor,
        sessions: sessions || [],
        csrfToken: req.csrfToken()
      });
    } catch (error) {
      console.error("Error loading doctor sessions:", error);
      res.status(500).render('error', { 
        message: "حدث خطأ أثناء تحميل الجلسات",
        csrfToken: req.csrfToken()
      });
    }
  });
  
  // Patient Sessions Route
  app.get('/patient/sessions', verii, csrfProtection, async (req, res) => {
    try {
      const sessions = await Appointment.find({
        patient: req.patient._id,
        date: { $gte: new Date() }
      }).populate('doctor', 'username profileImage specialization')
        .sort({ date: 1, time: 1 });
  
      res.render('patient-sessions', {
        patient: req.patient,
        sessions,
        csrfToken: req.csrfToken()
      });
    } catch (error) {
      console.error("Error loading patient sessions:", error);
      res.status(500).render('error', { 
        message: "حدث خطأ أثناء تحميل الجلسات",
        csrfToken: req.csrfToken()
      });
    }
  });
  
  // Start Session Route
  app.post('/api/sessions/start', doctorAuth, async (req, res) => {
    try {
        const { sessionId } = req.body;
        const session = await Appointment.findById(sessionId)
            .populate('patient', '_id name')
            .populate('doctor', '_id username profileImage');

        if (!session) {
            return res.status(404).json({ error: 'الجلسة غير موجودة' });
        }

        if (session.doctor._id.toString() !== req.doctor._id.toString()) {
            return res.status(403).json({ error: 'غير مصرح لك ببدء هذه الجلسة' });
        }

        

        // تحديث حالة الجلسة لبدء الجلسة
        await session.startSession();

        // إرسال إشعار للمريض عبر Socket.io
        io.to(`patient_${session.patient._id}`).emit('sessionReady', {
            sessionId: session._id,
            doctorName: req.doctor.username,
            doctorImage: req.doctor.profileImage
        });

        res.json({
            success: true,
            sessionId: session._id,
            patientName: session.patient.name,
            redirectUrl: `/session/${session._id}`
        });
    } catch (error) {
        console.error('Error starting session:', error);
        res.status(500).json({ error: 'فشل في بدء الجلسة: ' + error.message });
    }
});
app.get('/session/:id', async (req, res) => {
    try {
        const token = req.cookies.token || req.cookies.doctor_token;
        if (!token) {
            return res.redirect('/login'); // إعادة توجيه إلى صفحة تسجيل الدخول إذا لم يكن هناك توكن
        }

        let user, userType;
        try {
            const decoded = jwt.verify(token, secret);
            user = await Doctor.findById(decoded._id) || await Patient.findById(decoded._id);
            userType = user instanceof Doctor ? 'doctor' : 'patient';
        } catch (error) {
            return res.redirect('/login'); // إعادة توجيه إذا كان التوكن غير صالح
        }

        if (!user) {
            return res.redirect('/login');
        }

        const session = await Appointment.findById(req.params.id)
            .populate('doctor', 'username profileImage')
            .populate('patient', 'name profileImage');

        if (!session) {
            return res.status(404).render('error', {
                message: 'الجلسة غير موجودة',
                csrfToken: req.csrfToken()
            });
        }

        // التحقق من أن المستخدم هو إما الطبيب أو المريض المرتبط بالجلسة
        if (
            (userType === 'doctor' && session.doctor._id.toString() !== user._id.toString()) ||
            (userType === 'patient' && session.patient._id.toString() !== user._id.toString())
        ) {
            return res.status(403).render('error', {
                message: 'غير مصرح لك بالوصول إلى هذه الجلسة',
                csrfToken: req.csrfToken()
            });
        }

        res.render('session', {
            session,
            userType,
            csrfToken: req.csrfToken()
        });
    } catch (error) {
        console.error('Error loading session:', error);
        res.status(500).render('error', {
            message: 'حدث خطأ أثناء تحميل الجلسة: ' + error.message,
            csrfToken: req.csrfToken()
        });
    }
});
  
  // Error Handling Middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    fs.appendFileSync('error.log', `${new Date().toISOString()} - ${err.stack}\n`);
    
    if (req.accepts('html')) {
      res.status(500).render('error', { 
        message: "حدث خطأ في الخادم",
        csrfToken: req.csrfToken() 
      });
    } else if (req.accepts('json')) {
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      res.status(500).send('Internal Server Error');
    }
  });

app.post('/process-wallet-payment', verii, csrfProtection, async (req, res) => {
    try {
        const { doctorId, date, time, notes, amount } = req.body;
        const patientId = req.patient._id;
        
        
        if (!doctorId || !date || !time || !amount) {
            return res.status(400).json({ success: false, message: "بيانات الدفع غير مكتملة" });
        }
        
        
        const patient = await Patient.findById(patientId);
        if (patient.wallet.balance < amount) {
            return res.status(400).json({ success: false, message: "رصيد المحفظة غير كافٍ" });
        }
        
        
        patient.wallet.balance -= parseFloat(amount);
        patient.wallet.transactions.push({
            amount: -parseFloat(amount),
            date: new Date(),
            description: `دفع حجز موعد مع الطبيب ${doctorId}`,
            transactionType: 'payment'
        });
        
        
        const newAppointment = new Appointment({
            doctor: doctorId,
            patient: patientId,
            date: new Date(date),
            time: time,
            notes: notes || '',
            status: 'مؤكد',
            paymentMethod: 'محفظة',
            paymentStatus: 'مدفوع',
            amountPaid: amount
        });
        
        
        await patient.save();
        await newAppointment.save();
        
        res.json({ 
            success: true, 
            message: "تم الدفع وتأكيد الحجز بنجاح",
            newBalance: patient.wallet.balance
        });
    } catch (error) {
        console.error("Error processing wallet payment:", error);
        res.status(500).json({ 
            success: false, 
            message: "حدث خطأ أثناء عملية الدفع",
            error: error.message 
        });
    }
});

app.get('/admin/payments-management', adminAuth, (req, res) => {
    try {
        res.render('payments-management', {
            admin: req.admin,
            csrfToken: req.csrfToken()
        });
    } catch (error) {
        console.error('Render error:', error);
        res.status(500).send('حدث خطأ في تحميل الصفحة');
    }
});

app.get("/admin/search-patients", adminAuth, async (req, res) => {
    try {
        const email = req.query.email;
        const patients = await Patient.find({ 
            email: { $regex: email, $options: 'i' } 
        })
        .limit(5)
        .select('name email wallet.balance');
        
        res.json(patients);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ أثناء البحث' });
    }
});

app.post('/admin/add-wallet-funds', adminAuth, async (req, res) => {
    try {
        const { email, amount, description } = req.body;
        
        if (!email || !amount) {
            return res.status(400).json({ message: 'البريد الإلكتروني والمبلغ مطلوبان' });
        }

        const patient = await Patient.findOne({ email });
        if (!patient) {
            return res.status(404).json({ message: 'المريض غير موجود' });
        }
        
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount)) {  
            return res.status(400).json({ message: 'المبلغ يجب أن يكون رقماً' });
        }

        patient.wallet.balance += numericAmount;
        patient.wallet.transactions.push({
            amount: numericAmount,
            description: description || 'إضافة رصيد من قبل الإدارة',
            adminId: req.admin._id,
            transactionType: 'deposit'
        });
        
        await patient.save();
        
        res.json({ 
            success: true, 
            newBalance: patient.wallet.balance,
            patientName: patient.name
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ أثناء إضافة الرصيد' });
    }
});

app.get('/wallet', async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.redirect('/login');
        }

        const decoded = jwt.verify(token, "fgrpekrfg");
        const patient = await Patient.findOne({ _id: decoded._id });
        
        if (!patient) {
            return res.redirect('/login');
        }

        
        const sortedTransactions = patient.wallet.transactions.sort((a, b) => b.date - a.date);
        patient.wallet.transactions = sortedTransactions;

        res.render('wallet', { 
            patient: patient, 
            csrfToken: req.csrfToken() 
        });
    } catch (error) {
        console.error(error);
        res.redirect('/login');
    }
});

app.get("/book-appointment/:doctorId", verii, csrfProtection, async (req, res) => {
    try {
       
        const doctor = await Doctor.findById(req.params.doctorId);
        if (!doctor) {
            return res.status(404).render('error', { message: "الطبيب غير موجود" });
        }

        const existingAppointment = await Appointment.findOne({
            doctor: req.params.doctorId,
            patient: req.patient._id,
            date: { $gte: new Date() },
            status: { $ne: 'ملغي' }
        });

        res.render("book-appointment", {
            doctor,
            patient: req.patient,
            existingAppointment: existingAppointment || null,
            csrfToken: req.csrfToken()
        });
    } catch (error) {
        console.error("Error loading booking page:", error);
        res.status(500).render('error', { message: "حدث خطأ أثناء تحميل الصفحة" });
    }
});
app.get("/doctor/appointments", doctorAuth, csrfProtection, async (req, res) => {
    try {
        const hasUpcomingAppointments = await Appointment.exists({
            doctor: req.doctor._id,
            date: { $gte: new Date() },
            status: { $ne: 'ملغي' }
        });

        res.render("doctor-appointments", {
            doctor: req.doctor,
            hasUpcomingAppointments,
            csrfToken: req.csrfToken()
        });
    } catch (error) {
        console.error("Error loading doctor appointments:", error);
        res.status(500).render('error', { message: "حدث خطأ أثناء تحميل الصفحة" });
    }
});
app.post("/doctor/toggle-appointments", doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.doctor._id);
        if (!doctor) {
            return res.status(404).json({ 
                success: false, 
                message: "الطبيب غير موجود" 
            });
        }

        const newStatus = !doctor.acceptingAppointments;
        
        
        const updatedDoctor = await Doctor.findByIdAndUpdate(
            req.doctor._id, 
            { acceptingAppointments: newStatus },
            { new: true, runValidators: true }
        );

        if (!updatedDoctor) {
            return res.status(500).json({ 
                success: false, 
                message: "فشل في تحديث حالة الحجوزات" 
            });
        }

        res.json({ 
            success: true, 
            message: newStatus ? "تم تفعيل الحجوزات بنجاح" : "تم إيقاف الحجوزات بنجاح",
            newStatus
        });
    } catch (error) {
        console.error("Error toggling appointments:", error);
        res.status(500).json({ 
            success: false, 
            message: "حدث خطأ أثناء تغيير حالة الحجوزات",
            error: error.message 
        });
    }
});

app.get("/get-available-slots", async (req, res) => {
    try {
        const { doctorId, date, patientId } = req.query;
        if (!doctorId || !date) {
            return res.status(400).json({ message: "معرف الطبيب والتاريخ مطلوبان" });
        }

        const doctor = await Doctor.findById(doctorId);
        if (!doctor) {
            return res.status(404).json({ message: "الطبيب غير موجود" });
        }

        if (!doctor.acceptingAppointments) {
            return res.status(400).json({ message: "الطبيب لا يقبل الحجوزات حالياً" });
        }

        if (patientId) {
            const existingAppointment = await Appointment.findOne({
                doctor: doctorId,
                patient: patientId,
                date: { $gte: new Date() },
                status: { $ne: 'ملغي' }
            });

            if (existingAppointment) {
                return res.status(400).json({ 
                    message: "لديك موعد محجز مسبقاً مع هذا الطبيب",
                    existingAppointment 
                });
            }
        }

        const selectedDate = new Date(date);
        const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const dayName = days[selectedDate.getDay()];

        if (!doctor.availableDays || !doctor.availableDays.includes(dayName)) {
            return res.json({ availableSlots: [] });
        }

        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        const bookedAppointments = await Appointment.find({
            doctor: doctorId,
            date: { $gte: startOfDay, $lt: endOfDay },
            status: { $ne: 'ملغي' }
        });

        const bookedTimes = bookedAppointments.map(app => app.time);

        const availableSlots = [];
        
        const generateTimeSlots = (startTime, endTime) => {
            const [startHour, startMinute] = startTime.split(':').map(Number);
            const [endHour, endMinute] = endTime.split(':').map(Number);
            
            let currentHour = startHour;
            let currentMinute = startMinute;
            
            while (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
                const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
                
                let displayHour = currentHour;
                const period = displayHour >= 12 ? 'م' : 'ص';
                displayHour = displayHour % 12 || 12;
                const displayTime = `${displayHour}:${currentMinute.toString().padStart(2, '0')} ${period}`;
                
                if (!bookedTimes.includes(timeStr)) {
                    availableSlots.push(displayTime);
                }
                
                currentMinute += 30;
                if (currentMinute >= 60) {
                    currentMinute = 0;
                    currentHour++;
                }
            }
        };

        generateTimeSlots(doctor.morningStart, doctor.morningEnd);
        generateTimeSlots(doctor.eveningStart, doctor.eveningEnd);

        res.json({ availableSlots });
    } catch (error) {
        console.error("Error getting available slots:", error);
        res.status(500).json({ message: "حدث خطأ أثناء جلب الأوقات المتاحة" });
    }
});
app.post("/book-appointment", verii, csrfProtection, async (req, res) => {
    try {
        if (!req.patient) {
            return res.status(401).json({ success: false, message: "يجب تسجيل الدخول كـ مريض" });
        }

        const { doctorId, date, time, notes, paymentMethod } = req.body;
        const patientId = req.patient._id;
        
        if (!doctorId || !date || !time) {
            return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة" });
        }

        const doctor = await Doctor.findById(doctorId);
        if (!doctor) {
            return res.status(404).json({ success: false, message: "الطبيب غير موجود" });
        }

        if (!doctor.acceptingAppointments) {
            return res.status(400).json({ success: false, message: "الطبيب لا يقبل الحجوزات حالياً" });
        }

        const existingAppointment = await Appointment.findOne({
            doctor: doctorId,
            patient: patientId,
            date: { $gte: new Date() },
            status: { $ne: 'ملغي' }
        });

        if (existingAppointment) {
            return res.status(400).json({ 
                success: false, 
                message: "لديك موعد محجز مسبقاً مع هذا الطبيب",
                existingAppointment 
            });
        }

        const selectedDate = new Date(date);
        if (isNaN(selectedDate.getTime())) {
            return res.status(400).json({ success: false, message: "تاريخ غير صالح" });
        }

        if (!/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
            return res.status(400).json({ success: false, message: "تنسيق الوقت غير صحيح" });
        }

        const newAppointment = new Appointment({
            doctor: doctorId,
            patient: patientId,
            date: selectedDate,
            time: time,
            notes: notes || '',
            status: paymentMethod === 'إلكتروني' ? 'مؤكد' : 'غير مؤكد',
            paymentMethod: paymentMethod,
            paymentStatus: paymentMethod === 'إلكتروني' ? 'مدفوع' : 'غير مدفوع'
        });

        await newAppointment.save();

        res.json({ 
            success: true, 
            message: "تم حجز الموعد بنجاح",
            appointment: newAppointment
        });
    } catch (error) {
        console.error("Error booking appointment:", error);
        res.status(500).json({ 
            success: false, 
            message: "حدث خطأ أثناء حجز الموعد",
            error: error.message 
        });
    }
});

app.get("/doctor/get-appointments", doctorAuth, async (req, res) => {
    try {
        const appointments = await Appointment.find({ doctor: req.doctor._id })
            .populate({
                path: 'patient',
                select: 'name email',
                options: { allowNull: true }
            })
            .sort({ date: 1, time: 1 });

        const processedAppointments = appointments.map(app => ({
            _id: app._id,
            date: app.date,
            time: app.time,
            notes: app.notes || 'لا يوجد',
            status: app.status || 'مؤكد',
            paymentStatus: app.paymentStatus || 'غير مدفوع',
            paymentMethod: app.paymentMethod || 'غير محدد',
            patient: app.patient ? {
                name: app.patient.name,
                email: app.patient.email
            } : { name: 'مريض محذوف', email: '' }
        }));

        
        const hasUpcomingAppointments = await Appointment.exists({
            doctor: req.doctor._id,
            date: { $gte: new Date() },
            status: { $ne: 'ملغي' }
        });

        res.json({ 
            appointments: processedAppointments,
            hasUpcomingAppointments
        });
    } catch (error) {
        console.error("Error getting appointments:", error);
        res.status(500).json({ 
            message: "حدث خطأ أثناء جلب المواعيد",
            error: error.message
        });
    }
});

app.post("/doctor/save-availability", doctorAuth, async (req, res) => {
    try {
        const { days, morningStart, morningEnd, eveningStart, eveningEnd } = req.body;
        
        
        const hasUpcomingAppointments = await Appointment.exists({
            doctor: req.doctor._id,
            date: { $gte: new Date() },
            status: { $ne: 'ملغي' }
        });

        if (hasUpcomingAppointments) {
            return res.status(400).json({ 
                success: false, 
                message: "لا يمكن تعديل أوقات العمل بسبب وجود مواعيد قادمة" 
            });
        }

        if (!days || days.length === 0) {
            return res.status(400).json({ success: false, message: "يجب اختيار يوم عمل واحد على الأقل" });
        }

        await Doctor.findByIdAndUpdate(req.doctor._id, {
            $set: {
                availableDays: days,
                morningStart,
                morningEnd,
                eveningStart,
                eveningEnd
            }
        });

        res.json({ success: true, message: "تم حفظ أوقات التوفر بنجاح" });
    } catch (error) {
        console.error("Error saving availability:", error);
        res.status(500).json({ success: false, message: "حدث خطأ أثناء حفظ أوقات التوفر" });
    }
});

app.get("/doctor/get-availability", doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.doctor._id);
        res.json({
            availableDays: doctor.availableDays || [],
            morningStart: doctor.morningStart || '06:00',
            morningEnd: doctor.morningEnd || '12:00',
            eveningStart: doctor.eveningStart || '12:00',
            eveningEnd: doctor.eveningEnd || '18:00'
        });
    } catch (error) {
        console.error("Error getting doctor availability:", error);
        res.status(500).json({ message: "حدث خطأ أثناء جلب أوقات التوفر" });
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
    const { username, password } = req.body;
    try {
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


