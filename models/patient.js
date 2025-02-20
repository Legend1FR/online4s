// node-project\models\patient.js file
const mongoose = require("mongoose");

mongoose.connect("mongodb+srv://malhdar039:462039Mh@cluster0.kddsb.mongodb.net/all-data?retryWrites=true&w=majority&appName=Cluster0")
    .then(() => console.log("Connected to MongoDB"))
    .catch(() => console.log("Error connecting to MongoDB"));
    const patientSchema = new mongoose.Schema({
        name: String,
        email: String,
        password: String,
        isVerified: Boolean,
        isActive: Boolean,
        isFrozen: { type: Boolean, default: false }, // إضافة حقل isFrozen
        verificationCode: String,
        verificationCodeExpires: Date
    });
 



const Patient = mongoose.model("Patient", patientSchema);

module.exports = Patient;
