const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: [true, 'معرف الطبيب مطلوب']
    },
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: [true, 'معرف المريض مطلوب']
    },
    appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        required: [true, 'معرف الموعد مطلوب']
    },
    rating: {
        type: Number,
        required: [true, 'التقييم مطلوب'],
        min: [1, 'التقييم يجب أن يكون بين 1 و 5'],
        max: [5, 'التقييم يجب أن يكون بين 1 و 5']
    },
    comment: {
        type: String,
        trim: true,
        maxlength: [500, 'التعليق يجب ألا يتجاوز 500 حرف']
    },
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// لمنع التقييم المتكرر لنفس الجلسة
ratingSchema.index({ appointment: 1 }, { unique: true });

// لمنع المريض من تقييم نفس الطبيب أكثر من مرة لنفس الجلسة
ratingSchema.index({ doctor: 1, patient: 1, appointment: 1 }, { unique: true });

const Rating = mongoose.model('Rating', ratingSchema);

module.exports = Rating;