const mongoose = require("mongoose");
const Appointment = require("./appointment");

const patientSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: [true, 'الاسم مطلوب'],
        trim: true
    },
    email: { 
        type: String, 
        required: [true, 'البريد الإلكتروني مطلوب'],
        unique: true,
        lowercase: true,
        validate: {
            validator: function(v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: 'البريد الإلكتروني غير صالح'
        }
    },
    password: { 
        type: String, 
        required: [true, 'كلمة المرور مطلوبة'],
        minlength: [8, 'يجب أن تكون كلمة المرور على الأقل 8 أحرف']
    },
    profileImage: {
        type: String,
        default: '/images/default-patient.jpg'
    },
    isVerified: { 
        type: Boolean, 
        default: false 
    },
    isActive: { 
        type: Boolean, 
        default: true 
    },
    isFrozen: { 
        type: Boolean, 
        default: false 
    },
    verificationCode: String,
    verificationCodeExpires: Date,
    wallet: {
        balance: { type: Number, default: 0 },
        transactions: [{
            amount: Number,
            date: { type: Date, default: Date.now },
            description: String,
            adminId: mongoose.Schema.Types.ObjectId,
            transactionType: { type: String, enum: ['deposit', 'withdrawal', 'payment'] }
        }]
    },
    createdAt: { 
        type: Date, 
        default: Date.now,
        immutable: true
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for appointments
patientSchema.virtual('appointments', {
    ref: 'Appointment',
    localField: '_id',
    foreignField: 'patient'
});

// Method to get upcoming appointments
patientSchema.methods.getUpcomingAppointments = async function() {
    return await Appointment.find({
        patient: this._id,
        date: { $gte: new Date() },
        status: { $in: ['مؤكد', 'قيد الانتظار'] }
    }).populate('doctor', 'username profileImage specialization')
      .sort({ date: 1, time: 1 });
};

// Method to check if patient has session now
patientSchema.methods.hasActiveSession = async function() {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    return await Appointment.findOne({
        patient: this._id,
        date: {
            $eq: new Date(now.getFullYear(), now.getMonth(), now.getDate())
        },
        time: currentTime,
        status: 'مؤكد'
    }).populate('doctor', 'username profileImage');
};

const Patient = mongoose.model("Patient", patientSchema);

module.exports = Patient;