const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        required: false
    },
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: false
    },
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['appointment_payment', 'deposit'],
        default: 'appointment_payment'
    },
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true,
        enum: ['completed', 'failed', 'refunded'],
        default: 'completed'
    },
    transactionId: {
        type: String,
        required: true,
        unique: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// تعريف سكيما إعدادات النظام
const systemSettingsSchema = new mongoose.Schema({
    appointmentPrice: {
        type: Number,
        required: true,
        default: 200,
        min: 50,
        max: 1000
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    }
}, {
    timestamps: true
});

// Virtual for formatted amount
paymentSchema.virtual('formattedAmount').get(function() {
    return `${this.amount.toLocaleString('ar-YE')} ر.ي`;
});

// دالة للحصول على سعر الحجز الحالي
paymentSchema.statics.getAppointmentPrice = async function() {
    try {
        const settings = await this.model('SystemSettings').findOne().sort({ createdAt: -1 });
        return settings ? settings.appointmentPrice : 200;
    } catch (error) {
        console.error('Error getting appointment price:', error);
        return 200; // قيمة افتراضية في حالة الخطأ
    }
};

// دالة لتحديث سعر الحجز
paymentSchema.statics.updateAppointmentPrice = async function(newPrice, adminId) {
    try {
        if (isNaN(newPrice) || newPrice < 50 || newPrice > 1000) {
            throw new Error('السعر يجب أن يكون بين 50 و 1000 ريال');
        }

        const settings = new this.model('SystemSettings')({
            appointmentPrice: newPrice,
            updatedBy: adminId
        });

        await settings.save();
        return settings;
    } catch (error) {
        console.error('Error updating appointment price:', error);
        throw error;
    }
};

const Payment = mongoose.model('Payment', paymentSchema);
const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

module.exports = { Payment, SystemSettings };