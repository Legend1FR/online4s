
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
mongoose.connect("mongodb+srv://malhdar039:462039Mh@cluster0.kddsb.mongodb.net/all-data?retryWrites=true&w=majority&appName=Cluster0")
    .then(() => console.log("Connected to MongoDB"))
    .catch(() => console.log("Error connecting to MongoDB"));
const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});


adminSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

const Admin = mongoose.model("Admin", adminSchema);
module.exports = Admin;

