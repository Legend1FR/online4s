
const mongoose = require('mongoose');
const Doctor = require('./doctor');
const Patient = require('./patient');

const appointmentSchema = new mongoose.Schema({
    amountPaid: {
        type: Number,
        default: 100
    },
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
   
    paymentStatus: {
        type: String,
        enum: ['مدفوع', 'غير مدفوع', 'معلق'],
        default: 'غير مدفوع'
    },
    paymentMethod: {
        type: String,
        enum: ['لاحقا', 'إلكتروني', null],
        default: null
    },
    cancellationReason: {
        type: String,
        trim: true,
        maxlength: [200, 'سبب الإلغاء يجب ألا يتجاوز 200 حرف'],
        required: function() {
            return this.status === 'ملغي';
        }
    },
    chatHistory: [{
        sender: String,
        message: String,
        timestamp: Date,
        type: { type: String, enum: ['text', 'file'] }
    }],
    sessionStartedAt: Date,
    sessionEndedAt: Date,
    sessionDuration: Number,
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
    
    // Check time slot
    const [hours, minutes] = this.time.split(':').map(Number);
    const appointmentMinutes = hours * 60 + minutes;
    
    const [morningStartH, morningStartM] = doctor.morningStart.split(':').map(Number);
    const [morningEndH, morningEndM] = doctor.morningEnd.split(':').map(Number);
    const morningStart = morningStartH * 60 + morningStartM;
    const morningEnd = morningEndH * 60 + morningEndM;
    
    const [eveningStartH, eveningStartM] = doctor.eveningStart.split(':').map(Number);
    const [eveningEndH, eveningEndM] = doctor.eveningEnd.split(':').map(Number);
    const eveningStart = eveningStartH * 60 + eveningStartM;
    const eveningEnd = eveningEndH * 60 + eveningEndM;
    
    const isInMorning = appointmentMinutes >= morningStart && appointmentMinutes < morningEnd;
    const isInEvening = appointmentMinutes >= eveningStart && appointmentMinutes < eveningEnd;
    
    if (!isInMorning && !isInEvening) {
        throw new Error('الموعد خارج أوقات عمل الطبيب');
    }
    
    if (minutes !== 0 && minutes !== 30) {
        throw new Error('يجب أن يبدأ الموعد عند الساعة أو النصف ساعة');
    }
    
    // Handle payment status
    if (this.paymentMethod === 'إلكتروني' && this.isNew) {
        this.status = 'مؤكد';
        this.paymentStatus = 'مدفوع';
    } else if (this.paymentMethod === 'لاحقا' && this.isNew) {
        this.status = 'غير مؤكد';
        this.paymentStatus = 'غير مدفوع';
    }
    
    this.updatedAt = Date.now();
    next();
});


appointmentSchema.post('save', async function(doc) {
    if (doc.status === 'مؤكد' && doc.isNew) {
      
        console.log(`New appointment confirmed for patient ${doc.patient}`);
    }
});


appointmentSchema.methods.startSession = async function() {
    this.sessionStartedAt = new Date();
    this.status = 'مكتمل';
    await this.save();
};


appointmentSchema.methods.endSession = async function() {
    this.sessionEndedAt = new Date();
    this.sessionDuration = Math.floor((this.sessionEndedAt - this.sessionStartedAt) / 1000 / 60);
    await this.save();
};

// Virtual for formatted date
appointmentSchema.virtual('formattedDate').get(function() {
    return this.date.toLocaleDateString('ar-EG');
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;