

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const doctorSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true 
    },
    password: { 
        type: String, 
        required: true 
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    specialization: {
        type: String,
        required: true,
        enum: ["Cardiology", "Orthopedics", "Dermatology", "Pediatrics", "Internal Medicine", "Psychiatry", "Obstetrics and Gynecology", "Neurology", "General Practice", "Dentistry"]
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    isFrozen: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    profileImage: {
        type: String,
        default: '/images/default-doctor.jpg'
    }
});

// تشفير كلمة المرور قبل الحفظ
doctorSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

const Doctor = mongoose.model("Doctor", doctorSchema);
module.exports = Doctor;