require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function createAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        
        const existing = await User.findOne({ email: process.env.ADMIN_EMAIL });
        if (existing) {
            console.log('Admin already exists!');
            console.log('Email: ' + existing.email);
            process.exit(0);
        }
        
        const admin = new User({
            name: 'Admin',
            email: process.env.ADMIN_EMAIL,
            password: process.env.ADMIN_PASSWORD,
            phone: process.env.ADMIN_WHATSAPP,
            role: 'admin'
        });
        
        await admin.save();
        console.log('Admin created successfully!');
        console.log('Email: ' + admin.email);
        console.log('Password: Admin@123456');
        console.log('Now you can login!');
        
        process.exit(0);
    } catch (error) {
        console.error('Error: ' + error.message);
        process.exit(1);
    }
}

createAdmin();
