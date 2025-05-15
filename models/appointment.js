const mongoose = require('mongoose');
const Doctor = require('./doctor');
const Patient = require('./patient');

const appointmentSchema = new mongoose.Schema({
    doctor: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Doctor', 
        required: [true, 'الطبيب مطلوب'],
        index: true
    },
    patient: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Patient', 
        required: [true, 'المريض مطلوب'],
        index: true
    },
    date: { 
        type: Date, 
        required: [true, 'تاريخ الموعد مطلوب'],
        validate: {
            validator: function(date) {
                return date >= new Date().setHours(0, 0, 0, 0);
            },
            message: 'لا يمكن حجز موعد في تاريخ قديم'
        }
    },
    time: { 
        type: String, 
        required: [true, 'وقت الموعد مطلوب'],
        match: [/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, 'تنسيق الوقت غير صحيح']
    },
    diagnosis: { 
        type: String, 
        trim: true,
        maxlength: [1000, 'التشخيص يجب ألا يتجاوز 1000 حرف']
    },
    prescription: { 
        type: String, 
        trim: true,
        maxlength: [1000, 'الوصفة يجب ألا تتجاوز 1000 حرف']
    },
    nutrition: { 
        type: String, 
        trim: true,
        maxlength: [1000, 'التوصيات الغذائية يجب ألا تتجاوز 1000 حرف']
    },
    notes: { 
        type: String, 
        trim: true,
        maxlength: [500, 'الملاحظات يجب ألا تتجاوز 500 حرف']
    },
    followUp: {
        active: { type: Boolean, default: false },
        start: { type: Date },
        days: { type: Number, default: 7 }
    },
    status: {
        type: String,
        enum: ['قيد الانتظار', 'مؤكد', 'ملغي', 'مكتمل'],
        default: 'قيد الانتظار'
    },
    paymentStatus: {
        type: String,
        enum: ['مدفوع', 'غير مدفوع', 'معلق'],
        default: 'غير مدفوع'
    },
    paymentMethod: {
        type: String,
        enum: ['محفظة', null],
        default: null
    },
    paymentDetails: {
        amount: {
            type: Number,
            required: function() { return this.paymentMethod === 'محفظة'; }
        },
        method: {
            type: String,
            enum: ['wallet'],
            default: 'wallet'
        },
        transactionId: {
            type: String,
            required: function() { return this.paymentMethod === 'محفظة'; }
        }
    },
    amountPaid: {
        type: Number,
        default: 0
    },
    cancellationReason: {
        type: String,
        trim: true,
        maxlength: [200, 'سبب الإلغاء يجب ألا يتجاوز 200 حرف']
    },
    cancelledAt: {
        type: Date
    },
    refundAmount: {
        type: Number
    },
    restrictionApplied: {
        type: Boolean,
        default: false
    },
    remainingTime: { // الحقل الجديد لتخزين الوقت المتبقي
        type: Number,
        default: 0
    },
    chatHistory: [{
        sender: String,
        message: String,
        timestamp: Date,
        type: { type: String, enum: ['text', 'file'] },
        fileData: {
            fileName: String,
            fileSize: Number,
            fileType: String,
            fileUrl: String
        }
    }],
    sessionStartedAt: Date,
    sessionEndedAt: Date,
    sessionDuration: Number,
    doctorRequestedEnd: {
        type: Boolean,
        default: false
    },
    patientRequestedEnd: {
        type: Boolean,
        default: false
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

// Indexes
appointmentSchema.index(
    { doctor: 1, date: 1, time: 1 }, 
    { unique: true, partialFilterExpression: { status: { $ne: 'ملغي' } } }
);

// Pre-save validation
appointmentSchema.pre('save', async function(next) {
    const doctor = await Doctor.findById(this.doctor);
    if (!doctor) {
        throw new Error('الطبيب غير موجود');
    }
    
    // Check doctor availability
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayName = days[this.date.getDay()];
    
    if (!doctor.availableDays.includes(dayName)) {
        throw new Error('الطبيب غير متاح في هذا اليوم');
    }
    
    // Handle payment status
    if (this.paymentMethod === 'محفظة' && this.isNew) {
        this.status = 'قيد الانتظار'; // سيتم التأكيد بعد اكتمال الدفع
        this.paymentStatus = 'معلق';
  
    }
    
    this.updatedAt = Date.now();
    next();
});

// Virtuals
appointmentSchema.virtual('payment', {
    ref: 'Payment',
    localField: '_id',
    foreignField: 'appointment',
    justOne: true
});

appointmentSchema.virtual('rating', {
    ref: 'Rating',
    localField: '_id',
    foreignField: 'appointment',
    justOne: true
});

appointmentSchema.virtual('formattedDate').get(function() {
    return this.date.toLocaleDateString('ar-EG');
});

// Methods
appointmentSchema.methods.startSession = async function() {
    this.sessionStartedAt = new Date();
    this.status = 'قيد الانتظار';
    await this.save();
};

appointmentSchema.methods.requestEndSession = async function(userType) {
    if (this.status === 'مكتمل') {
        return { success: false, error: 'الجلسة منتهية بالفعل' };
    }

    if (userType === 'doctor') {
        this.doctorRequestedEnd = true;
    } else if (userType === 'patient') {
        this.patientRequestedEnd = true;
    }

    await this.save();
    
    return { 
        success: true, 
        message: 'تم إرسال طلب إنهاء الجلسة',
        requestedBy: userType
    };
};

appointmentSchema.methods.approveEndSession = async function() {
    this.sessionEndedAt = new Date();
    this.status = 'مكتمل';
    this.sessionDuration = Math.floor(
        (this.sessionEndedAt - this.sessionStartedAt) / 1000 / 60
    );
    
    await this.save();
    
    return { 
        success: true, 
        message: 'تم إنهاء الجلسة بنجاح',
        sessionId: this._id
    };
};

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;