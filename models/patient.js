const mongoose = require("mongoose");
const Appointment = require("./appointment");
const Doctor = require('./doctor');

mongoose.connect("mongodb+srv://malhdar039:462039Mh@cluster0.kddsb.mongodb.net/all-data?retryWrites=true&w=majority&appName=Cluster0")
    .then(() => console.log("Connected to MongoDB"))
    .catch(() => console.log("Error connecting to MongoDB"));
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
<<<<<<< HEAD
            message: 'البريد الإلكتروني غير صالح'
=======
            transactions: [{
                amount: {
                    type: Number,
                    required: true
                },
                date: {
                    type: Date,
                    default: Date.now
                },
                description: {
                    type: String,
                    required: true
                },
                type: {
                    type: String,
                    enum: ['appointment_payment', 'deposit', 'refund'],
                    required: true
                },
                appointmentId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Appointment'
                },
                doctorName: {
                    type: String
                },
                adminAdded: {
                    type: Boolean,
                    default: false
                },
                cancelled: {
                    type: Boolean,
                    default: false
                },
                refundPercentage: {
                    type: Number,
                    min: 0,
                    max: 100
                }
            }]
        },
        
        isVerified: { 
            type: Boolean, 
            default: false 
        },
        isActive: { 
            type: Boolean, 
            default: true 
        },
        verificationCode: String,
        verificationCodeExpires: Date,
        createdAt: { 
            type: Date, 
            default: Date.now,
            immutable: true
        },
        updatedAt: { 
            type: Date, 
            default: Date.now 
>>>>>>> a7a5b16802c9127625fa8133dee330a4d940ef88
        }
    },
    password: { 
        type: String, 
        required: [true, 'كلمة المرور مطلوبة'],
        minlength: [8, 'يجب أن تكون كلمة المرور على الأقل 8 أحرف']
    },
    
    wallet: {
        balance: {
            type: Number,
            default: 0,
            min: 0
        },
        transactions: [{
            amount: {
                type: Number,
                required: true
            },
            date: {
                type: Date,
                default: Date.now
            },
            description: {
                type: String,
                required: true
            },
            type: {
                type: String,
                enum: ['appointment_payment', 'deposit'],
                required: true
            },
            appointmentId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Appointment'
            },
            doctorName: {
                type: String
            },
            adminAdded: {
                type: Boolean,
                default: false
            }
        }]
    },
    isVerified: { 
        type: Boolean, 
        default: false 
    },
    isActive: { 
        type: Boolean, 
        default: true 
    },
    verificationCode: String,
    verificationCodeExpires: Date,
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

// Method to add funds to wallet
patientSchema.methods.addFunds = async function(amount, description, adminAdded = false) {
    this.wallet.balance += amount;
    this.wallet.transactions.push({
        amount,
        description,
        type: 'deposit',
        adminAdded
    });
    await this.save();
    return this.wallet.balance;
};

// Method to pay from wallet
patientSchema.methods.payFromWallet = async function(amount, description, appointmentId, doctorName) {
    if (typeof amount !== 'number' || amount <= 0) {
        throw new Error('المبلغ يجب أن يكون رقمًا موجبًا');
    }

    if (this.wallet.balance < amount) {
        throw new Error('رصيد المحفظة غير كافٍ');
    }
    
    this.wallet.balance -= amount;
    this.wallet.transactions.push({
        amount: -amount,
        date: new Date(),
        description: description || 'دفع حجز موعد',
        type: 'appointment_payment',
        appointmentId,
        doctorName
    });
    
    await this.save();
    return this.wallet.balance;
};
// Method to refund 50% of the appointment fee
patientSchema.methods.refundHalf = async function(amount, appointmentId, doctorName) {
    if (typeof amount !== 'number' || amount <= 0) {
        throw new Error('المبلغ يجب أن يكون رقمًا موجبًا');
    }

    const refundAmount = amount * 0.5; // استرداد 50% من المبلغ
    this.wallet.balance += refundAmount;
    this.wallet.transactions.push({
        amount: refundAmount,
        date: new Date(),
        description: 'استرداد 50% من مبلغ الموعد الملغي',
        type: 'deposit',
        appointmentId,
        doctorName
    });

    await this.save();
    return this.wallet.balance;
};
// Method to check restriction
patientSchema.methods.checkRestriction = async function(doctorId) {
    const restriction = await mongoose.model('AppointmentRestriction').findOne({
        patient: this._id,
        doctor: doctorId,
        expiresAt: { $gt: new Date() }
    });
    
<<<<<<< HEAD
    return restriction ? {
        restricted: true,
        expiresAt: restriction.expiresAt,
        hoursLeft: Math.ceil((restriction.expiresAt - new Date()) / (1000 * 60 * 60))
    } : { restricted: false };
};

const Patient = mongoose.model("Patient", patientSchema);

module.exports = Patient;

=======
    patientSchema.methods.addRefund = async function(amount, description, appointmentId, doctorName, percentage) {
        if (typeof amount !== 'number' || amount <= 0) {
            throw new Error('المبلغ يجب أن يكون رقمًا موجبًا');
        }
        
        this.wallet.balance += amount;
        this.wallet.transactions.push({
            amount,
            date: new Date(),
            description: description || 'استرداد حجز موعد',
            type: 'refund',
            appointmentId,
            doctorName,
            refundPercentage: percentage
        });
    // Method to add funds to wallet
    patientSchema.methods.addFunds = async function(amount, description, adminAdded = false) {
        this.wallet.balance += amount;
        this.wallet.transactions.push({
            amount,
            description,
            type: 'deposit',
            adminAdded
        });
        await this.save();
        return this.wallet.balance;
    };
    patientSchema.methods.payFromWallet = async function(amount, description, appointmentId, doctorName) {
        if (typeof amount !== 'number' || amount <= 0) {
            throw new Error('المبلغ يجب أن يكون رقمًا موجبًا');
        }
      
        if (this.wallet.balance < amount) {
            throw new Error('رصيد المحفظة غير كافٍ');
        }
        
        this.wallet.balance -= amount;
        this.wallet.transactions.push({
            amount: -amount,
            date: new Date(),
            description: description || 'دفع حجز موعد',
            type: 'appointment_payment',
            appointmentId,
            doctorName
        });
        
        await this.save();
        return this.wallet.balance;
    };
    const originalPaymentIndex = this.wallet.transactions.findIndex(
        t => t.appointmentId && t.appointmentId.toString() === appointmentId.toString() && t.type === 'appointment_payment'
    );
    
    if (originalPaymentIndex !== -1) {
        this.wallet.transactions[originalPaymentIndex].cancelled = true;
    }
    
    await this.save();
    return this.wallet.balance;
};
    const Patient = mongoose.model("Patient", patientSchema);
    
    module.exports = Patient;
>>>>>>> a7a5b16802c9127625fa8133dee330a4d940ef88
