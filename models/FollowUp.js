const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema({
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  diagnosis: { type: String },
prescription: { type: String },
  messages: [{
    sender: { type: String, enum: ['doctor', 'patient'], required: true },
    message: String,
    timestamp: { type: Date, default: Date.now },
    type: { type: String, enum: ['text', 'file'], default: 'text' },
    fileData: {
      fileName: String,
      fileSize: Number,
      fileType: String,
      fileUrl: String
    }
  }],
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }
});

const FollowUp = mongoose.model('FollowUp', followUpSchema);
module.exports = FollowUp;