const mongoose = require('mongoose');
const { isEmail } = require('validator');
const Appointment = require('./appointment');

const doctorSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: [true, 'اسم المستخدم مطلوب'],
        unique: true,
        trim: true,
        minlength: [3, 'يجب أن يكون اسم المستخدم على الأقل 3 أحرف']
    },
    email: { 
        type: String, 
        required: [true, 'البريد الإلكتروني مطلوب'],
        unique: true,
        lowercase: true,
        validate: [isEmail, 'البريد الإلكتروني غير صالح']
    },
    password: { 
        type: String, 
        required: [true, 'كلمة المرور مطلوبة'],
        minlength: [8, 'يجب أن تكون كلمة المرور على الأقل 8 أحرف']
    },
    specialization: { 
        type: String, 
        required: [true, 'التخصص الطبي مطلوب'],
        trim: true
    },
    profileImage: { 
        type: String, 
        default: '/images/default-doctor.jpg',
        validate: {
            validator: function(v) {
                return /\.(jpg|jpeg|png)$/i.test(v);
            },
            message: 'يجب أن تكون الصورة بصيغة JPG, JPEG أو PNG'
        }
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
    availableDays: { 
        type: [{
            type: String,
            enum: ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']
        }],
        validate: {
            validator: function(days) {
                return days && days.length > 0;
            },
            message: 'يجب تحديد يوم عمل واحد على الأقل'
        }
    },
    morningStart: { 
        type: String,
        default: '08:00',
        validate: {
            validator: function(time) {
                return /^(0[8-9]|1[0-1]):(00|30)$/.test(time);
            },
            message: 'يجب أن تكون الفترة الصباحية بين 8 صباحاً و12 ظهراً بفاصل 30 دقيقة'
        }
    },
    morningEnd: { 
        type: String,
        default: '12:00',
        validate: {
            validator: function(time) {
                return /^(0[8-9]|1[0-2]):(00|30)$/.test(time);
            },
            message: 'يجب أن تكون الفترة الصباحية بين 8 صباحاً و12 ظهراً بفاصل 30 دقيقة'
        }
    },
    eveningStart: { 
        type: String,
        default: '13:00',
        validate: {
            validator: function(time) {
                return /^(1[3-9]|2[0-2]):(00|30)$/.test(time);
            },
            message: 'يجب أن تكون الفترة المسائية بين 1 ظهراً و10 مساءً بفاصل 30 دقيقة'
        }
    },
    eveningEnd: { 
        type: String,
        default: '22:00',
        validate: {
            validator: function(time) {
                return /^(1[3-9]|2[0-2]):(00|30)$/.test(time);
            },
            message: 'يجب أن تكون الفترة المسائية بين 1 ظهراً و10 مساءً بفاصل 30 دقيقة'
        }
    },
    appointmentDuration: {
        type: Number,
        default: 30,
        enum: [30],
        message: 'مدة الموعد يجب أن تكون 30 دقيقة'
    },
    sessionPrice: {
        type: Number,
        default: 100,
        min: [50, 'لا يمكن أن يكون سعر الجلسة أقل من 50 ريال'],
        max: [1000, 'لا يمكن أن يكون سعر الجلسة أكثر من 1000 ريال']
    },
    acceptingAppointments: {
        type: Boolean,
        default: true
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
doctorSchema.virtual('appointments', {
    ref: 'Appointment',
    localField: '_id',
    foreignField: 'doctor'
});

// Pre-save validation
doctorSchema.pre('save', function(next) {
    if (this.morningStart && this.morningEnd) {
        const [startH, startM] = this.morningStart.split(':').map(Number);
        const [endH, endM] = this.morningEnd.split(':').map(Number);
        
        if (endH < startH || (endH === startH && endM <= startM)) {
            throw new Error('وقت نهاية الفترة الصباحية يجب أن يكون بعد وقت البداية');
        }
    }
    
    if (this.eveningStart && this.eveningEnd) {
        const [startH, startM] = this.eveningStart.split(':').map(Number);
        const [endH, endM] = this.eveningEnd.split(':').map(Number);
        
        if (endH < startH || (endH === startH && endM <= startM)) {
            throw new Error('وقت نهاية الفترة المسائية يجب أن يكون بعد وقت البداية');
        }
    }
    
    this.updatedAt = Date.now();
    next();
});

// Method to get available time slots
doctorSchema.methods.getAvailableSlots = async function(date, patientId = null) {
    try {
        const AppointmentModel = mongoose.model('Appointment');
        const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const dayName = dayNames[date.getDay()];
        
        if (!this.availableDays || !this.availableDays.includes(dayName)) {
            return [];
        }
        
        // Check for existing appointment if patientId is provided
        if (patientId) {
            const existingAppointment = await AppointmentModel.findOne({
                doctor: this._id,
                patient: patientId,
                status: { $nin: ['ملغي', 'مكتمل'] }
            });
            
            if (existingAppointment) {
                throw new Error('لديك موعد محجز مسبقاً مع هذا الطبيب');
            }
        }
        
        // Get existing appointments for this date
        const appointments = await AppointmentModel.find({
            doctor: this._id,
            date: date,
            status: { $ne: 'ملغي' }
        });
        
        const bookedSlots = appointments.map(app => app.time);
        const allSlots = [];
        
        // Generate morning slots
        const [morningStartH, morningStartM] = this.morningStart.split(':').map(Number);
        const [morningEndH, morningEndM] = this.morningEnd.split(':').map(Number);
        
        let currentH = morningStartH;
        let currentM = morningStartM;
        
        while (currentH < morningEndH || (currentH === morningEndH && currentM < morningEndM)) {
            const slot = `${currentH.toString().padStart(2, '0')}:${currentM.toString().padStart(2, '0')}`;
            if (!bookedSlots.includes(slot)) {
                allSlots.push(slot);
            }
            
            currentM += this.appointmentDuration;
            if (currentM >= 60) {
                currentM = 0;
                currentH++;
            }
        }
        
        // Generate evening slots
        const [eveningStartH, eveningStartM] = this.eveningStart.split(':').map(Number);
        const [eveningEndH, eveningEndM] = this.eveningEnd.split(':').map(Number);
        
        currentH = eveningStartH;
        currentM = eveningStartM;
        
        while (currentH < eveningEndH || (currentH === eveningEndH && currentM < eveningEndM)) {
            const slot = `${currentH.toString().padStart(2, '0')}:${currentM.toString().padStart(2, '0')}`;
            if (!bookedSlots.includes(slot)) {
                allSlots.push(slot);
            }
            
            currentM += this.appointmentDuration;
            if (currentM >= 60) {
                currentM = 0;
                currentH++;
            }
        }
        
        return allSlots;
    } catch (error) {
        console.error('Error in getAvailableSlots:', error);
        throw error;
    }
};

// Method to check if doctor is available at specific time
doctorSchema.methods.isAvailable = async function(date, time) {
    try {
        const slots = await this.getAvailableSlots(date);
        return slots.includes(time);
    } catch (error) {
        console.error('Error in isAvailable:', error);
        return false;
    }
};

// Method to get upcoming appointments
doctorSchema.methods.getUpcomingAppointments = async function() {
    try {
        const AppointmentModel = mongoose.model('Appointment');
        return await AppointmentModel.find({
            doctor: this._id,
            date: { $gte: new Date() },
            status: { $in: ['مؤكد', 'قيد الانتظار'] }
        }).populate('patient', 'name email')
          .sort({ date: 1, time: 1 });
    } catch (error) {
        console.error('Error in getUpcomingAppointments:', error);
        throw error;
    }
};

// Method to get today's appointments
doctorSchema.methods.getTodaysAppointments = async function() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const AppointmentModel = mongoose.model('Appointment');
        return await AppointmentModel.find({
            doctor: this._id,
            date: { $gte: today, $lt: tomorrow },
            status: { $in: ['مؤكد', 'قيد الانتظار'] }
        }).populate('patient', 'name email profileImage')
          .sort({ time: 1 });
    } catch (error) {
        console.error('Error in getTodaysAppointments:', error);
        throw error;
    }
};

const Doctor = mongoose.model('Doctor', doctorSchema);

module.exports = Doctor;