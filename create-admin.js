require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const createAdmin = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB Connected!');

        // Check if admin exists
        const adminExists = await User.findOne({ 
            email: 'sachinbamniya0143@gmail.com' 
        });

        if (adminExists) {
            console.log('✅ Admin already exists!');
            console.log('Email:', adminExists.email);
            console.log('Role:', adminExists.role);
            return;
        }

        // Create admin user
        const admin = await User.create({
            name: 'Sachin Bamniya',
            email: 'sachinbamniya0143@gmail.com',
            phone: '+919174406375',
            password: 'admin@2025',
            role: 'superadmin',
            permissions: {
                canCreateCampaigns: true,
                canImportContacts: true,
                canUseTemplates: true,
                canAccessAnalytics: true,
                canManageOrders: true,
                canAccessAdmin: true,
                maxCampaignsPerDay: 9999,
                maxContactsPerCampaign: 999999,
                maxOrdersPerDay: 9999
            },
            location: {
                pincode: '465110',
                city: 'Shajapur',
                state: 'Madhya Pradesh',
                country: 'India'
            },
            isActive: true,
            isVerified: true
        });

        console.log('✅ ADMIN CREATED SUCCESSFULLY!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📧 Email: sachinbamniya0143@gmail.com');
        console.log('🔐 Password: admin@2025');
        console.log('👑 Role: superadmin');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

createAdmin();
