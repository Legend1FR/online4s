// models/payment.js
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
        enum: ['appointment_payment', 'deposit', 'refund'],
        default: 'appointment_payment'
    },
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true,
        enum: ['completed', 'failed', 'refunded', 'partially_refunded'],
        default: 'completed'
    },
    transactionId: {
        type: String,
        required: true,
        unique: true
    },
    relatedAppointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment'
    },
    refundPercentage: {
        type: Number,
        min: 0,
        max: 100
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

// Indexes
paymentSchema.index({ appointment: 1 });
paymentSchema.index({ patient: 1 });
paymentSchema.index({ doctor: 1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ type: 1 });
paymentSchema.index({ status: 1 });

// Virtual for formatted amount
paymentSchema.virtual('formattedAmount').get(function() {
    const sign = this.amount >= 0 ? '+' : '-';
    return `${sign} ${Math.abs(this.amount).toLocaleString('ar-YE')} ر.ي`;
});

paymentSchema.virtual('formattedAmount').get(function() {
    return `${this.amount.toLocaleString('ar-YE')} ر.ي`;
});
// Virtual for refund details
paymentSchema.virtual('refundDetails').get(function() {
    if (this.type === 'refund') {
        return `تم استرداد ${this.refundPercentage || 50}% من المبلغ`;
    }
    return null;
});
// Virtual for payment type in Arabic
paymentSchema.virtual('typeArabic').get(function() {
    const types = {
        'appointment_payment': 'دفع موعد',
        'deposit': 'إيداع',
        'refund': 'استرداد'
    };
    return types[this.type] || this.type;
});

// Static method to get payment stats
paymentSchema.statics.getStats = async function(patientId = null) {
    const match = patientId ? { patient: mongoose.Types.ObjectId(patientId) } : {};
    
    const stats = await this.aggregate([
        { $match: match },
        { 
            $group: {
                _id: null,
                totalPayments: { $sum: { $cond: [{ $eq: ["$type", "appointment_payment"] }, "$amount", 0] } },
                totalDeposits: { $sum: { $cond: [{ $eq: ["$type", "deposit"] }, "$amount", 0] } },
                totalRefunds: { $sum: { $cond: [{ $eq: ["$type", "refund"] }, "$amount", 0] } },
                count: { $sum: 1 }
            }
        }
    ]);
    
    return stats.length > 0 ? stats[0] : {
        totalPayments: 0,
        totalDeposits: 0,
        totalRefunds: 0,
        count: 0
    };
};

// Middleware to update updatedAt
paymentSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Method to mark as refunded
paymentSchema.methods.markAsRefunded = async function(percentage, note = '') {
    if (this.status === 'refunded') {
        throw new Error('المعاملة مستردة بالفعل');
    }
    
    this.status = 'refunded';
    this.refundPercentage = percentage;
    this.adminNote = note;
    
    await this.save();
    return this;
};

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;