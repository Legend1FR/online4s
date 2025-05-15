const express = require('express');
const path = require('path');
const patientRoutes = require('./routes/patient');

const app = express();

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Middleware to parse request body
app.use(express.urlencoded({ extended: true }));

// Use patient routes
app.use('/patient', patientRoutes);

// Home route
app.get('/', (req, res) => {
    res.send('Welcome to My Patient Profile App');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});