



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
const Rating = require('./models/rating');
const Payment = require('./models/payment');
const { name, render } = require("ejs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const cookeparser = require("cookie-parser");
const csrf = require("csurf");
const fs = require("fs");
const nodemailer = require("nodemailer");
const path = require('path');
const exceljs = require('exceljs');
const pdfmake = require('pdfmake');
const multer = require('multer');
let APPOINTMENT_PRICE = 800;

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
const csrfMiddleware = csrf({ cookie: true });
app.use((req, res, next) => {
  if (req.path === '/api/sessions/upload-file') {
    return next();
  }
  csrfMiddleware(req, res, next);
})
app.use(express.static('public')); 

const sessionFileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, 'public/session-files');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, 'session-file-' + uniqueSuffix + ext);
    }
  });
  
  const uploadSessionFile = multer({ 
    storage: sessionFileStorage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
  });
const storage = multer.diskStorage({
    destination: (req, file, cb


    ) => {
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
app.get("/", async (req, res) => {
    try {
        const token = req.cookies.token;
        let patient = null;
        
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || "fgrpekrfg");
                patient = await Patient.findOne({ _id: decoded._id }).lean();
            } catch (authError) {
                console.error("Authentication error:", authError);
                res.clearCookie('token');
                // تمرير رسالة الخطأ كمتغير error
                return res.render("index", { 
                    error: {
                        message: "انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى"
                    },
                    patient: null,
                    doctors: [],
                    csrfToken: req.csrfToken()
                });
            }
        }

        let doctors = [];
        try {
            doctors = await Doctor.aggregate([
                { $match: { isActive: true, isVerified: true } },
                { $sample: { size: 10 } },
                { $project: { 
                    username: 1, 
                    specialization: 1, 
                    profileImage: 1,
                    _id: 1
                }}
            ]);
        } catch (dbError) {
            console.error("Database error:", dbError);
            // تمرير رسالة الخطأ كمتغير error
            return res.render("index", { 
                error: {
                    message: "حدث خطأ في جلب بيانات الأطباء"
                },
                patient: patient,
                doctors: [],
                csrfToken: req.csrfToken()
            });
        }

        res.render("index", {
            patient: patient,
            doctors: doctors,
            csrfToken: req.csrfToken(),
            error: null // تمرير null كقيمة افتراضية
        });

    } catch (error) {
        console.error("Unexpected error in home route:", error);
        res.status(500).render("index", {
            error: {
                message: "نواجه بعض الصعوبات التقنية. يرجى المحاولة لاحقاً."
            },
            patient: null,


            doctors: [],
            csrfToken: req.csrfToken()
        });
    }
});



// مسار تقديم التقييم
app.post('/api/ratings', verii, csrfProtection, async (req, res) => {
    try {
        const { appointmentId, doctorId, rating, comment } = req.body;
        const patientId = req.patient._id;

        // التحقق من البيانات المطلوبة
        if (!appointmentId || !doctorId || !rating) {
            return res.status(400).json({
                success: false,
                message: 'معرف الموعد والتقييم مطلوبان'
            });
        }

        // التحقق من أن الموعد منتهي
        const appointment = await Appointment.findOne({
            _id: appointmentId,
            patient: patientId,
            status: 'مكتمل'
        });

        if (!appointment) {
            return res.status(400).json({
                success: false,
                message: 'لا يمكن تقييم موعد غير منتهي أو غير موجود'
            });
        }

        // التحقق من عدم وجود تقييم سابق لنفس الموعد
        const existingRating = await Rating.findOne({
            appointment: appointmentId,
            patient: patientId
        });

        if (existingRating) {
            return res.status(400).json({
                success: false,
                message: 'لقد قمت بتقييم هذه الجلسة مسبقاً'
            });
        }

        // إنشاء التقييم الجديد
        const newRating = new Rating({
            doctor: doctorId,
            patient: patientId,
            appointment: appointmentId,
            rating: rating,
            comment: comment
        });

        await newRating.save();

        res.json({
            success: true,
            message: 'تم تقديم التقييم بنجاح',
            rating: newRating
        });

    } catch (error) {
        console.error('Error submitting rating:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء تقديم التقييم',
            error: error.message
        });
    }
});

// مسار الحصول على تقييمات الطبيب
app.get('/api/doctors/:id/ratings', async (req, res) => {
    try {
        const { id } = req.params;
        const { sort = 'recent', limit = 5 } = req.query;

        let sortOption = { createdAt: -1 }; // افتراضي: الأحدث أولاً
        if (sort === 'highest') {
            sortOption = { rating: -1 };
        } else if (sort === 'lowest') {
            sortOption = { rating: 1 };
        } else if (sort === 'oldest') {
            sortOption = { createdAt: 1 };
        }

        const ratings = await Rating.find({ doctor: id })
            .populate('patient', 'name profileImage')
            .sort(sortOption)
            .limit(parseInt(limit));

        const averageRating = await Doctor.findById(id).then(doc => doc.getAverageRating());

        res.json({
            success: true,
            ratings,
            averageRating
        });

    } catch (error) {
        console.error('Error fetching doctor ratings:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء جلب التقييمات'
        });
    }
});
// Add this route to your server.js
app.get("/api/doctors/random", async (req, res) => {
    try {
        const doctors = await Doctor.aggregate([
            { $match: { isActive: true, isVerified: true } },
            { $sample: { size: 10 } }, // Get 10 random doctors
            { $project: { 
                username: 1,
                specialization: 1,
                profileImage: 1,
                _id: 1
            }}
        ]);
        
        res.json(doctors);
    } catch (error) {
        console.error('Error fetching random doctors:', error);
        res.status(500).json({ error: 'Failed to fetch doctors' });
    }
});
app.get('/api/sessions/check-completed', async (req, res) => {
    try {
      const result = await Appointment.updateMany(
        { 
          date: { $lte: new Date() },
          status: { $ne: 'مكتمل' }
        },
        { 
          $set: { 
            status: 'مكتمل',
            sessionEndedAt: new Date(),
            sessionDuration: 30
          } 
        }
      );
      
      res.json({ updated: result.nModified > 0 });
    } catch (error) {
      console.error('Error checking completed sessions:', error);
      res.status(500).json({ error: 'حدث خطأ أثناء التحقق من الجلسات' });
    }
  });

app.get('/doctor/reports', doctorAuth, async (req, res) => {
    try {
        const reports = await Appointment.find({ 
            doctor: req.doctor._id,
            status: 'مكتمل'
        })
        .populate('patient', 'name profileImage')
        .sort({ sessionEndedAt: -1 });

        res.render('doctor-reports', {
            doctor: req.doctor,
            reports,
            csrfToken: req.csrfToken()
        });
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).render('error', { 
            message: "حدث خطأ أثناء جلب التقارير",
            doctor: req.doctor
        });
    }
});
app.post('/api/sessions/request-end', async (req, res) => {
    try {
      const { sessionId, userType } = req.body;
      const session = await Appointment.findById(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'الجلسة غير موجودة' });
      }
  
      const result = await session.requestEndSession(userType);
      io.to(sessionId).emit('endSessionRequested', { requestedBy: userType });
  
      res.json(result);
    } catch (error) {
      console.error('Error requesting session end:', error);
      res.status(500).json({ error: 'حدث خطأ أثناء طلب إنهاء الجلسة' });
    }
  });

  app.post('/api/sessions/approve-end', async (req, res) => {
    try {
      const { sessionId } = req.body;
      const session = await Appointment.findById(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'الجلسة غير موجودة' });
      }
  
      const result = await session.approveEndSession();
      io.to(sessionId).emit('sessionEnded', result);
  
      res.json(result);
    } catch (error) {
      console.error('Error approving session end:', error);
      res.status(500).json({ error: 'حدث خطأ أثناء إنهاء الجلسة' });
    }
  });
  
// مسار لطلب جلسة جديدة من الطبيب
app.post('/api/sessions/request-new', doctorAuth, async (req, res) => {
    try {
        const { patientId, date, time, notes } = req.body;
        const doctorId = req.doctor._id;

        const newAppointment = new Appointment({
            doctor: doctorId,
            patient: patientId,
            date: new Date(date),
            time: time,
            notes: notes || '',
            status: 'مؤكد',
            paymentMethod: 'لاحقا',
            paymentStatus: 'غير مدفوع'
        });

        await newAppointment.save();
        io.to(patientId.toString()).emit('newSessionRequested', {
            doctor: req.doctor.username,
            date: newAppointment.formattedDate,
            time: newAppointment.time
        });

        res.json({ 
            success: true, 
            message: "تم طلب الجلسة بنجاح",
            appointment: newAppointment
        });
    } catch (error) {
        console.error('Error requesting new session:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء طلب الجلسة' });
    }
});
app.post('/api/sessions/upload-file', uploadSessionFile.single('sessionFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'لم يتم رفع أي ملف' });
      }
  
      const { sessionId, senderType } = req.body;
      const session = await Appointment.findById(sessionId);
      if (!session) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'الجلسة غير موجودة' });
      }
  
      const fileData = {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        fileUrl: `/session-files/${req.file.filename}`,
        timestamp: new Date()
      };
  
      // حفظ الملف في سجل المحادثة
      session.chatHistory.push({
        sender: senderType,
        message: fileData.fileName,
        timestamp: new Date(),
        type: "file",
        fileData: fileData
      });
  
      await session.save();
  
      // إرسال الملف لجميع المشاركين في الجلسة
      io.to(sessionId).emit('newFileMessage', {
        ...fileData,
        sender: senderType,
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      });
  
      res.json({
        success: true,
        fileData: fileData
      });
  
    } catch (error) {
      console.error('Error uploading session file:', error);
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: 'حدث خطأ أثناء رفع الملف' });
    }
  });
  
  // مسار لتحميل ملفات الجلسات
  app.use('/session-files', express.static(path.join(__dirname, 'public/session-files')));
  
  // مسار لجلب سجل المحادثة
  app.get('/api/sessions/:sessionId/messages', async (req, res) => {
    try {
      const session = await Appointment.findById(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: 'الجلسة غير موجودة' });
      }
  
      res.json(session.chatHistory);
    } catch (error) {
      console.error('Error fetching session messages:', error);
      res.status(500).json({ error: 'حدث خطأ أثناء جلب سجل المحادثة' });
    }
  });// تحديث مسار جلسات الطبيب
  app.get("/doctor/sessions", doctorAuth, async (req, res) => {
      try {
          // فحص وتحديث الجلسات المنتهية
          await Appointment.updateMany(
              { 
                  doctor: req.doctor._id,
                  date: { $lte: new Date() },
                  status: { $ne: 'مكتمل' }
              },
              { 
                  $set: { 
                      status: 'مكتمل',
                      sessionEndedAt: new Date(),
                      sessionDuration: 30
                  } 
              }
          );
  
          const sessions = await Appointment.find({ 
              doctor: req.doctor._id,
              status: { $ne: 'مكتمل' }
          })
          .populate("patient", "name profileImage")
          .sort({ date: 1, time: 1 });
  
          res.render("doctor-sessions", {
              doctor: req.doctor,
              sessions,
              csrfToken: req.csrfToken(),
          });
      } catch (error) {
          console.error('Error loading doctor sessions:', error);
          res.render("doctor-sessions", {
              doctor: req.doctor,
              sessions: [],
              error: "حدث خطأ أثناء تحميل الجلسات",
              csrfToken: req.csrfToken()
          });
      }
  });
  // مسار جلسات المريض
app.get("/patient/sessions", verii, async (req, res) => {
    try {
        // تحديث الجلسات المنتهية تلقائياً
        await Appointment.updateMany(
            { 
                patient: req.patient._id,
                date: { $lte: new Date() },
                status: { $ne: 'مكتمل' }
            },
            { 
                $set: { 
                    status: 'مكتمل',
                    sessionEndedAt: new Date(),
                    sessionDuration: 30
                } 
            }
        );

        const sessions = await Appointment.find({
            patient: req.patient._id,
            status: { $in: ['مؤكد', 'قيد الانتظار'] }
        })
        .populate({
            path: "doctor",
            select: "username profileImage specialization",
            populate: {
                path: "ratings",
                match: { patient: req.patient._id }
            }
        })
        .sort({ date: 1, time: 1 });

        const completedSessions = await Appointment.find({
            patient: req.patient._id,
            status: 'مكتمل'
        })
        .populate({
            path: "doctor",
            select: "username profileImage specialization"
        })
        .populate("rating")
        .sort({ date: -1, time: -1 });

        // حساب متوسط التقييم لكل طبيب
        for (let session of completedSessions) {
            if (session.doctor) {
                session.doctor.avgRating = await Rating.aggregate([
                    { $match: { doctor: session.doctor._id } },
                    { $group: { _id: null, average: { $avg: "$rating" } } }
                ]).then(result => result.length > 0 ? result[0].average.toFixed(1) : 0);
            }
        }

        res.render("patient-sessions", {
            patient: req.patient,
            sessions,
            completedSessions,
            csrfToken: req.csrfToken(),
        });
    } catch (error) {
        console.error('Error loading patient sessions:', error);
        res.render("patient-sessions", {
            patient: req.patient,
            sessions: [],
            completedSessions: [],
            error: "حدث خطأ أثناء تحميل الجلسات",
            csrfToken: req.csrfToken()
        });
    }
});


  // مسار بدء الجلسة
  app.post("/api/sessions/start", doctorAuth, async (req, res) => {
      try {
          const { sessionId } = req.body;
          if (!sessionId) return res.status(400).json({ error: "معرف الجلسة مفقود" });
  
          const session = await Appointment.findById(sessionId).populate("patient");
          if (!session) return res.status(404).json({ error: "الجلسة غير موجودة" });
          if (session.doctor.toString() !== req.doctor._id.toString()) {
              return res.status(403).json({ error: "غير مصرح" });
          }
  
          await session.startSession();
          io.to(sessionId).emit("sessionStarted", {
              sessionId,
              doctorName: req.doctor.username,
          });
  
          res.json({ 
              success: true, 
              redirectUrl: `/doctor/session/${sessionId}` 
          });
      } catch (error) {
          console.error('Error starting session:', error);
          res.status(500).json({ 
              error: "فشل في بدء الجلسة",
              details: error.message 
          });
      }
  });
 
  app.get("/doctor/session/:id", doctorAuth, async (req, res) => {
    try {
      const session = await Appointment.findById(req.params.id).populate(
        "patient",
        "name"
      );
      if (!session) return res.status(404).json({ error: "الجلسة غير موجودة" });
      if (session.doctor.toString() !== req.doctor._id.toString()) {
        return res.status(403).json({ error: "غير مصرح" });
      }
      res.render("doctor-session", { session, csrfToken: req.csrfToken() });
    } catch (error) {
      res.status(500).json({ error: "خطأ في تحميل الجلسة" });
    }
  });
  
 
  app.get("/patient/session/:id", verii, async (req, res) => {
    try {
      const session = await Appointment.findById(req.params.id).populate(
        "doctor",
        "username"
      );
      if (!session) return res.status(404).json({ error: "الجلسة غير موجودة" });
      if (session.patient.toString() !== req.patient._id.toString()) {
        return res.status(403).json({ error: "غير مصرح" });
      }
      res.render("patient-session", { session, csrfToken: req.csrfToken() });
    } catch (error) {
      res.status(500).json({ error: "خطأ في تحميل الجلسة" });
    }
  });
  
io.on("connection", (socket) => {
    console.log("New user connected:", socket.id);

    socket.on("joinSession", ({ sessionId, userType }) => {
        socket.join(sessionId);
        socket.userType = userType;
        socket.broadcast.to(sessionId).emit("userConnected", { userType });
    });

    socket.on("sendMessage", async ({ sessionId, message, timestamp }) => {
        try {
            const session = await Appointment.findById(sessionId);
            if (session && session.status !== 'مكتمل') {
                session.chatHistory.push({
                    sender: socket.userType,
                    message,
                    timestamp: new Date(timestamp),
                    type: "text"
                });
                await session.save();
                
                const time = new Date(timestamp).toLocaleTimeString('ar-EG', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                io.to(sessionId).emit("newMessage", {
                    sender: socket.userType,
                    text: message,
                    time: time
                });
            }
        } catch (error) {
            console.error('Error saving message:', error);
        }
    });

    socket.on("offer", ({ sessionId, offer }) => {
        socket.to(sessionId).emit("offer", offer);
    });

    socket.on("answer", ({ sessionId, answer }) => {
        socket.to(sessionId).emit("answer", answer);
    });

    socket.on("iceCandidate", ({ sessionId, candidate }) => {
        socket.to(sessionId).emit("iceCandidate", candidate);
    });

    socket.on("requestEndSession", async ({ sessionId }) => {
        try {
            const session = await Appointment.findById(sessionId);
            if (session) {
                io.to(sessionId).emit("endSessionRequested", { 
                    requestedBy: socket.userType 
                });
            }
        } catch (error) {
            console.error('Error handling end session request:', error);
        }
    });

    socket.on("approveEndSession", async ({ sessionId }) => {
        try {
            const session = await Appointment.findById(sessionId);
            if (session) {
                session.sessionEndedAt = new Date();
                session.status = 'مكتمل';
                session.sessionDuration = Math.floor(
                    (new Date() - session.sessionStartedAt) / 1000 / 60
                );
                await session.save();
                
                io.to(sessionId).emit("sessionEnded", { 
                    success: true,
                    message: "تم إنهاء الجلسة بنجاح"
                });
            }
        } catch (error) {
            console.error('Error approving session end:', error);
        }
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
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
app.get('/admin/payments-management', adminAuth, async (req, res) => {
    try {
        // جلب إعدادات سعر الحجز من قاعدة البيانات إذا كنت تخزنه هناك
        // أو استخدم القيمة الافتراضية إذا لم تكن مخزنة
        const appointmentPrice = APPOINTMENT_PRICE || 300; // 100 كقيمة افتراضية مثال

        res.render('payments-management', {
            admin: req.admin,
            APPOINTMENT_PRICE: appointmentPrice,
            csrfToken: req.csrfToken()
        });
    } catch (error) {
        console.error('Error in payments-management route:', error);
        res.status(500).render('error', {
            message: "حدث خطأ في تحميل صفحة إدارة المدفوعات",
            error: error.message
        });
    }
});

// مسار إضافة رصيد للمحفظة (محدث)
app.post('/admin/add-wallet-funds', adminAuth, async (req, res) => {
    try {
        const { email, amount, description } = req.body;
        
        if (!email || !amount || !description) {
            return res.status(400).json({
                success: false,
                message: 'جميع الحقول مطلوبة'
            });
        }
        
        const patient = await Patient.findOne({ email });
        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'المريض غير موجود'
            });
        }
        
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            return res.status(400).json({
                success: false,
                message: 'المبلغ يجب أن يكون رقماً موجباً'
            });
        }
        
        // إضافة الرصيد
        await patient.addFunds(amountNum, description, true);
        
        // تسجيل المعاملة في سجل المدفوعات
        const payment = new Payment({
            patient: patient._id,
            amount: amountNum,
            type: 'deposit',
            description: `إيداع بواسطة الأدمن: ${description}`,
            transactionId: `DEP-${Date.now()}`
        });
        
        await payment.save();
        
        res.json({
            success: true,
            message: 'تمت إضافة الرصيد بنجاح',
            newBalance: patient.wallet.balance
        });
    } catch (error) {
        console.error('Error adding wallet funds:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء إضافة الرصيد'
        });
    }
});




// مسار تصدير سجل المدفوعات
app.get('/admin/export-payments', adminAuth, async (req, res) => {
    try {
        const { type, startDate, endDate } = req.query;
        
        let query = {};
        
        // تطبيق الفلتر حسب النوع
        if (type === 'credit_card') {
            query.paymentMethod = 'credit_card';
        } else if (type === 'wallet') {
            query.paymentMethod = 'wallet';
        }
        
        // تطبيق الفلتر حسب التاريخ
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            
            query.createdAt = {
                $gte: start,
                $lte: end
            };
        }
        
        const payments = await Payment.find(query)
            .populate('patient', 'name email')
            .populate('doctor', 'username specialization')
            .sort({ createdAt: -1 })
            .lean();
        
        // تحويل البيانات إلى CSV
        let csvData = 'تاريخ العملية,المريض,البريد الإلكتروني,الطبيب,التخصص,المبلغ ($),المبلغ (ر.ي),طريقة الدفع,الحالة,معرف Stripe\n';
        
        payments.forEach(payment => {
            csvData += `"${new Date(payment.createdAt).toLocaleString('ar-SA')}",`;
            csvData += `"${payment.patient.name}",`;
            csvData += `"${payment.patient.email}",`;
            csvData += `"${payment.doctor.username}",`;
            csvData += `"${payment.doctor.specialization}",`;
            csvData += `"${payment.amount.toFixed(2)}",`;
            csvData += `"${(payment.amount * payment.exchangeRate).toFixed(2)}",`;
            csvData += `"${payment.paymentMethod === 'credit_card' ? 'بطاقة ائتمانية' : 'محفظة'}",`;
            csvData += `"${payment.status === 'completed' ? 'مكتمل' : payment.status === 'failed' ? 'فشل' : 'قيد الانتظار'}",`;
            csvData += `"${payment.stripePaymentId || '--'}"\n`;
        });
        
        // إرسال الملف
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=payments_export.csv');
        res.send(csvData);
        
    } catch (error) {
        console.error('Error exporting payments:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء تصدير سجل المدفوعات'
        });
    }
});

// مسار البحث عن المرضى (محدث)
app.get('/admin/search-patients', adminAuth, async (req, res) => {
    try {
        const { email } = req.query;
        
        if (!email || email.length < 3) {
            return res.json([]);
        }
        
        const patients = await Patient.find({
            email: { $regex: email, $options: 'i' }
        })
        .select('name email wallet')
        .limit(5)
        .lean();
        
        res.json(patients);
    } catch (error) {
        console.error('Error searching patients:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء البحث عن المرضى'
        });
    }
});

// Wallet Routes
app.get('/wallet', verii, async (req, res) => {
    try {
        const patient = await Patient.findById(req.patient._id);
        if (!patient) {
            return res.status(404).render('wallet', { 
                error: { message: "المريض غير موجود" },
                patient: null,
                csrfToken: req.csrfToken()
            });
        }

        // Sort transactions by date descending
        patient.wallet.transactions.sort((a, b) => b.date - a.date);

        res.render('wallet', { 
            patient: patient,
            csrfToken: req.csrfToken(),
            error: null
        });
    } catch (error) {
        console.error('Error in wallet route:', error);
        res.status(500).render('wallet', { 
            error: { message: "حدث خطأ أثناء تحميل صفحة المحفظة" },
            patient: null,
            csrfToken: req.csrfToken()
        });
    }
});
// مسار تحديث سعر الحجز
app.post('/admin/update-appointment-price', adminAuth, async (req, res) => {
    try {
        const { price } = req.body;
        
        if (!price || isNaN(price)) { // هنا كان ينقص القوس الختامي
            return res.status(400).json({
                success: false,
                message: 'السعر يجب أن يكون رقماً صحيحاً'
            });
        }
        
        // هنا يمكنك حفظ السعر في قاعدة البيانات أو ملف الإعدادات
        // سنفترض أننا نستخدم متغير APPOINTMENT_PRICE الذي تم تعريفه في الأعلى
        APPOINTMENT_PRICE = parseFloat(price);
        
        res.json({
            success: true,
            message: 'تم تحديث سعر الحجز بنجاح',
            newPrice: APPOINTMENT_PRICE
        });
    } catch (error) {
        console.error('Error updating appointment price:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء تحديث سعر الحجز'
        });
    }
});
app.get("/book-appointment/:doctorId", verii, csrfProtection, async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.params.doctorId)
            .populate({
                path: 'ratings',
                select: 'rating comment patient createdAt',
                populate: {
                    path: 'patient',
                    select: 'name profileImage'
                }
            })
            .lean();

        if (!doctor) {
            return res.status(404).render('error', { message: "الطبيب غير موجود" });
        }

        // حساب متوسط التقييم
        const ratings = doctor.ratings || [];
        const avgRating = ratings.length > 0 ? 
            (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length) : 0;

        const existingAppointment = await Appointment.findOne({
            doctor: req.params.doctorId,
            patient: req.patient._id,
            status: { $ne: 'مكتمل' }
        });

        res.render("book-appointment", {
            doctor: {
                ...doctor,
                avgRating: parseFloat(avgRating.toFixed(1)),
                ratingCount: ratings.length
            },
            patient: req.patient,
            existingAppointment,
            APPOINTMENT_PRICE: APPOINTMENT_PRICE, // قيمة ثابتة أو يمكن جلبها من قاعدة البيانات
            
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
                status: { $nin: ['ملغي', 'مكتمل'] }
            });

            if (existingAppointment) {
                return res.status(400).json({ 
                    message: "لديك موعد محجز مسبقاً مع هذا الطبيب",
                    existingAppointment 
                });
            }
        }

        const selectedDate = new Date(date);
        const now = new Date();
        const isToday = selectedDate.toDateString() === now.toDateString();
        
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
                
                // تخطي الأوقات التي مضى أكثر من ساعة على وقتها الحالي إذا كان اليوم هو اليوم الحالي
                if (isToday) {
                    const slotTime = new Date(now);
                    slotTime.setHours(currentHour, currentMinute, 0, 0);
                    const diffInHours = (slotTime - now) / (1000 * 60 * 60);
                    
                    if (diffInHours < 1) {
                        currentMinute += 30;
                        if (currentMinute >= 60) {
                            currentMinute = 0;
                            currentHour++;
                        }
                        continue;
                    }
                }
                
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
app.get('/admin/payments', adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 10, filter, date } = req.query;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        if (filter && filter !== 'all') {
            query.type = filter === 'deposit' ? 'deposit' : 'appointment_payment';
        }
        
        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            
            query.createdAt = {
                $gte: startDate,
                $lte: endDate
            };
        }
        
        const payments = await Payment.find(query)
            .populate('patient', 'name email')
            .populate('doctor', 'username specialization')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();
            
        const totalPayments = await Payment.countDocuments(query);
        
        res.json({
            success: true,
            payments: payments,
            totalPages: Math.ceil(totalPayments / limit)
        });
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء جلب سجل المدفوعات'
        });
    }
});
// server.js
app.get('/admin/search-doctors', adminAuth, async (req, res) => {
    try {
        const query = req.query.query;
        
        if (!query || query.length < 3) {
            return res.json([]);
        }
        
        const doctors = await Doctor.find({
            $or: [
                { username: { $regex: query, $options: 'i' } },
                { specialization: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
            ]
        })
        .limit(10)
        .select('username specialization email sessionPrice')
        .lean();
        
        res.json(doctors);
    } catch (error) {
        console.error('Error searching doctors:', error);
        res.status(500).json([]);
    }
});
// مسار حجز الموعد (محدث)
app.post("/book-appointment", verii, csrfProtection, async (req, res) => {
    try {
      const { doctorId, date, time, notes } = req.body;
      const patientId = req.patient._id;
      
      // التحقق من صحة البيانات المدخلة
      if (!doctorId || !date || !time) {
        return res.status(400).json({ 
          success: false, 
          message: "بيانات غير مكتملة",
          errors: {
            doctorId: !doctorId ? "معرف الطبيب مطلوب" : undefined,
            date: !date ? "تاريخ الموعد مطلوب" : undefined,
            time: !time ? "وقت الموعد مطلوب" : undefined
          }
        });
      }
  
      // جلب بيانات الطبيب والمريض
      const [doctor, patient] = await Promise.all([
        Doctor.findById(doctorId),
        Patient.findById(patientId)
      ]);
  
      if (!doctor) {
        return res.status(404).json({ 
          success: false, 
          message: "الطبيب غير موجود"
        });
      }
  
      if (!doctor.acceptingAppointments) {
        return res.status(400).json({ 
          success: false, 
          message: "الطبيب لا يقبل الحجوزات حالياً"
        });
      }
  
      // معالجة التاريخ والوقت
      const selectedDate = new Date(date);
      if (isNaN(selectedDate.getTime())) {
        return res.status(400).json({ 
          success: false, 
          message: "تاريخ غير صالح"
        });
      }
  
      // التحقق من أن التاريخ ليس في الماضي
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        return res.status(400).json({ 
          success: false, 
          message: "لا يمكن حجز موعد في تاريخ قديم"
        });
      }
  
      // التحقق من صحة الوقت
      if (!/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
        return res.status(400).json({ 
          success: false, 
          message: "تنسيق الوقت غير صحيح"
        });
      }
  
      // التحقق من المواعيد المتضاربة
      const existingAppointment = await Appointment.findOne({
        doctor: doctorId,
        patient: patientId,
        status: { $nin: ['ملغي', 'مكتمل'] }
      });
  
      if (existingAppointment) {
        return res.status(409).json({ 
          success: false, 
          message: "لديك موعد محجز مسبقاً مع هذا الطبيب",
          existingAppointment: {
            id: existingAppointment._id,
            date: existingAppointment.date,
            time: existingAppointment.time,
            status: existingAppointment.status
          }
        });
      }
  
      // التحقق من توفر الوقت
      const isAvailable = await doctor.isAvailable(selectedDate, time);
      if (!isAvailable) {
        const availableSlots = await doctor.getAvailableSlots(selectedDate);
        return res.status(400).json({ 
          success: false, 
          message: "الوقت المحدد غير متاح",
          availableSlots
        });
      }
  
      // التحقق من رصيد المحفظة
      const appointmentPrice = APPOINTMENT_PRICE;
      if (patient.wallet.balance < appointmentPrice) {
        return res.status(402).json({ 
          success: false, 
          message: "رصيد المحفظة غير كافٍ",
          requiredAmount: appointmentPrice,
          currentBalance: patient.wallet.balance
        });
      }
  
      // إنشاء الموعد الجديد
      const newAppointment = new Appointment({
        doctor: doctorId,
        patient: patientId,
        date: selectedDate,
        time: time,
        notes: notes || '',
        paymentMethod: 'محفظة',
        paymentStatus: 'مدفوع',
        status: 'مؤكد',
        amountPaid: appointmentPrice,
        paymentDetails: {
          amount: appointmentPrice,
          method: 'wallet',
          transactionId: `APPT-${Date.now()}-${patientId.toString().slice(-4)}`
        }
      });
  
      // خصم المبلغ من محفظة المريض
      await patient.payFromWallet(
        appointmentPrice,
        `حجز موعد مع د. ${doctor.username}`,
        newAppointment._id,
        doctor.username
      );
  
      // إنشاء سجل الدفع
      const payment = new Payment({
        appointment: newAppointment._id,
        patient: patientId,
        doctor: doctorId,
        amount: appointmentPrice,
        type: 'appointment_payment',
        description: `حجز موعد مع د. ${doctor.username}`,
        status: 'completed',
        transactionId: newAppointment.paymentDetails.transactionId
      });
  
      await Promise.all([
        newAppointment.save(),
        payment.save()
      ]);
  
      res.json({ 
        success: true, 
        message: "تم حجز الموعد بنجاح",
        appointment: {
          id: newAppointment._id,
          date: newAppointment.date,
          time: newAppointment.time,
          status: newAppointment.status
        },
        newBalance: patient.wallet.balance
      });
  
    } catch (error) {
      console.error("Error in book-appointment:", error);
      
      let errorMessage = "حدث خطأ غير متوقع";
      if (error.name === 'ValidationError') {
        errorMessage = "بيانات غير صالحة";
      } else if (error.name === 'MongoError' && error.code === 11000) {
        errorMessage = "تعارض في المواعيد";
      }
  
      res.status(500).json({ 
        success: false, 
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
app.get("/check-existing-appointment", verii, async (req, res) => {
    try {
        const { doctorId, patientId } = req.query;
        
        const existingAppointment = await Appointment.findOne({
            doctor: doctorId,
            patient: patientId,
            status: { $nin: ['ملغي', 'مكتمل'] }
        });
        
        res.json({ 
            hasExisting: !!existingAppointment,
            existingAppointment: existingAppointment || null
        });
    } catch (error) {
        console.error("Error checking existing appointment:", error);
        res.status(500).json({ 
            message: "حدث خطأ أثناء التحقق من المواعيد",
            error: error.message
        });
    }
});
app.get("/api/sessions/check-status", verii, async (req, res) => {
    try {
        const now = new Date();
        const updatedSessions = await Appointment.updateMany({
            patient: req.patient._id,
            status: 'مؤكد',
            date: { $lte: now },
            time: { $lte: now.toLocaleTimeString('en-US', { hour12: false }) }
        }, {
            $set: { status: 'مكتمل' }
        });
        
        res.json({ 
            updated: updatedSessions.modifiedCount > 0
        });
    } catch (error) {
        console.error("Error checking sessions status:", error);
        res.status(500).json({ 
            message: "حدث خطأ أثناء التحقق من حالة الجلسات",
            error: error.message
        });
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

// تحديث route إضافة الأدمن
app.post("/admin/add-admin", adminAuth, async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // التحقق من البيانات المدخلة
        if (!username || !password) {
            const admins = await Admin.find({}, 'username').lean();
            return res.render("settingAdmin", {
                admin: req.admin,
                admins: admins,
                csrfToken: req.csrfToken(),
                error: "يجب إدخال اسم المستخدم وكلمة المرور",
                success: null
            });
        }
        
        // التحقق من قوة كلمة المرور
        if (password.length < 8) {
            const admins = await Admin.find({}, 'username').lean();
            return res.render("settingAdmin", {
                admin: req.admin,
                admins: admins,
                csrfToken: req.csrfToken(),
                error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل",
                success: null
            });
        }
        
        // التحقق من عدم تكرار اسم المستخدم (باستخدام تعبير منتظم لحساسية الحروف)
        const existingAdmin = await Admin.findOne({ 
            username: { $regex: new RegExp(`^${username}$`, 'i') }
        });
        
        if (existingAdmin) {
            const admins = await Admin.find({}, 'username').lean();
            return res.render("settingAdmin", {
                admin: req.admin,
                admins: admins,
                csrfToken: req.csrfToken(),
                error: "اسم المستخدم موجود بالفعل (قد يكون بحروف مختلفة)",
                success: null
            });
        }
        
        // إنشاء الأدمن الجديد مع هاش كلمة المرور
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const newAdmin = new Admin({ 
            username: username.trim(), 
            password: hashedPassword 
        });
        
        await newAdmin.save();
        
        // جلب القائمة المحدثة مع ترتيب أبجدي
        const updatedAdmins = await Admin.find({}, 'username')
            .sort({ username: 1 })
            .lean();
        
        res.render("settingAdmin", {
            admin: req.admin,
            admins: updatedAdmins,
            csrfToken: req.csrfToken(),
            error: null,
            success: `تمت إضافة الأدمن "${username.trim()}" بنجاح`
        });
        
    } catch (error) {
        console.error("Error adding admin:", error);
        
        // جلب القائمة الحالية حتى في حالة الخطأ
        const admins = await Admin.find({}, 'username').lean().catch(() => []);
        
        res.render("settingAdmin", {
            admin: req.admin,
            admins: admins,
            csrfToken: req.csrfToken(),
            error: "حدث خطأ أثناء إضافة الأدمن: " + error.message,
            success: null
        });
    }
});
// إضافة route للتحقق من اسم المستخدم
app.post('/admin/check-username', adminAuth, async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ error: 'اسم المستخدم مطلوب' });
        }
        
        // التحقق من وجود المستخدم (حساسية الحروف)
        const existingAdmin = await Admin.findOne({ 
            username: { $regex: new RegExp(`^${username}$`, 'i') }
        });
        
        res.json({ exists: !!existingAdmin });
    } catch (error) {
        console.error('Error checking username:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء التحقق' });
    }
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
        
        res.redirect("/login");
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
app.post("/login", async (req, res) => {
    const { name, password } = req.body;
    try {
        // البحث عن المستخدم بدون التحسس لحالة الأحرف
        const patient = await Patient.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        
        if (!patient) {
            return res.json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
        }

        if (patient.isFrozen) {
            return res.json({ error: "حسابك مجمد. يرجى الاتصال بالإدارة." });
        }

        const isMatch = await bcrypt.compare(password, patient.password);
        if (!isMatch) {
            return res.json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
        }

        const token = jwt.sign({ _id: patient._id }, "fgrpekrfg", { expiresIn: "1h" });
        res.cookie("token", token, { httpOnly: true });
        return res.json({ redirect: "/" });
    } catch (error) {
        console.error("Error during login:", error);
        return res.json({ error: "حدث خطأ أثناء تسجيل الدخول" });
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
        const patient = token ? await Patient.findOne({ _id: jwt.verify(token, "fgrpekrfg")._id }) : null;
        
        const specialization = req.query.specialization;
        let doctors = await Doctor.find(specialization && specialization !== 'all' ? 
            { specialization } : {})
            .populate({
                path: 'ratings',
                select: 'rating patient',
                populate: {
                    path: 'patient',
                    select: 'name profileImage'
                }
            })
            .lean();

        // حساب متوسط التقييم لكل طبيب
        doctors = doctors.map(doctor => {
            const ratings = doctor.ratings || [];
            const ratingCount = ratings.length;
            const avgRating = ratingCount > 0 ? 
                (ratings.reduce((sum, r) => sum + r.rating, 0) / ratingCount) : 0;
            
            return {
                ...doctor,
                avgRating: parseFloat(avgRating.toFixed(1)),
                ratingCount
            };
        });

        res.render("doctor-list", { 
            patient, 
            doctors, 
            csrfToken: req.csrfToken() 
        });
    } catch (error) {
        console.error('Error in request-session:', error);
        res.render("doctor-list", { 
            patient: null, 
            doctors: [], 
            error: "حدث خطأ أثناء جلب بيانات الأطباء",
            csrfToken: req.csrfToken() 
        });
    }
});


