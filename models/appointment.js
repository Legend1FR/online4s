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
    notes: { 
        type: String, 
        trim: true,
        maxlength: [500, 'الملاحظات يجب ألا تتجاوز 500 حرف']
    },
    status: {
        type: String,
        enum: ['قيد الانتظار', 'مؤكد', 'ملغي', 'مكتمل'],
        default: 'قيد الانتظار'
    },
    paymentStatus: {
        type: String,
        enum: ['مدفوع', 'غير مدفوع', 'معلق', 'مسترد جزئياً', 'مسترد بالكامل'],
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
    },
    refundAmount: {
        type: Number,
        default: 0
    },
    lastCancellationDate: {
        type: Date
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
        this.status = 'قيد الانتظار';
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

appointmentSchema.virtual('formattedDate').get(function() {
    return this.date.toLocaleDateString('ar-EG');
});

appointmentSchema.virtual('rating', {
    ref: 'Rating',
    localField: '_id',
    foreignField: 'appointment',
    justOne: true
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

appointmentSchema.methods.cancelAppointment = async function(reason, refundPercentage = 0.5) {
    if (this.status === 'ملغي') {
        throw new Error('الموعد ملغي بالفعل');
    }

    if (this.status === 'مكتمل') {
        throw new Error('لا يمكن إلغاء موعد مكتمل');
    }

    this.status = 'ملغي';
    this.cancellationReason = reason;
    this.updatedAt = new Date();

    // Process refund if paid via wallet
    if (this.paymentStatus === 'مدفوع' && this.paymentMethod === 'محفظة') {
        const refundAmount = Math.floor(this.amountPaid * refundPercentage);
        const patient = await Patient.findById(this.patient);
        
        if (patient) {
            await patient.addFunds(
                refundAmount,
                `إرجاع جزئي لإلغاء موعد مع د. ${this.doctor.username}`,
                false
            );

            // Record refund payment
            const refundPayment = new Payment({
                patient: this.patient,
                doctor: this.doctor,
                amount: refundAmount,
                type: 'refund',
                description: `إرجاع جزئي لإلغاء موعد - ${reason}`,
                status: 'completed',
                transactionId: `REF-${Date.now()}`,
                relatedAppointment: this._id
            });

            await refundPayment.save();
        }
    }

    await this.save();
    return this;
};

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;