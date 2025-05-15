const mongoose = require('mongoose');
mongoose.connect("mongodb+srv://malhdar039:462039Mh@cluster0.kddsb.mongodb.net/all-data?retryWrites=true&w=majority&appName=Cluster0")
    .then(() => console.log("Connected to MongoDB"))
    .catch(() => console.log("Error connecting to MongoDB"));
const restrictionSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: true
    },
    restrictionType: {
        type: String,
        enum: ['post_cancellation', 'previous_appointment_block'], // إضافة نوع جديد للحظر
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// إنشاء فهرس لضمان عدم وجود تكرار للحظر بين المريض والطبيب
restrictionSchema.index({ patient: 1, doctor: 1 });

// فهرس لحذف الحظر تلقائيًا عند انتهاء الوقت
restrictionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AppointmentRestriction = mongoose.model('AppointmentRestriction', restrictionSchema);

module.exports = AppointmentRestriction;