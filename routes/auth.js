const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'default_secret_key_2025', {
        expiresIn: '30d'
    });
};

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', async (req, res) => {
    try {
        const { name, email, phone, password, pincode, city, state } = req.body;

        // Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ 
                success: false, 
                error: 'User already exists with this email' 
            });
        }

        // Create user
        const user = await User.create({
            name,
            email,
            phone,
            password,
            location: { pincode, city, state }
        });

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                token: generateToken(user._id)
            }
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid email or password' 
            });
        }

        // Check password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid email or password' 
            });
        }

        // Update last login
        await user.updateLastLogin();

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                permissions: user.permissions,
                whatsappConnected: user.whatsapp.connected,
                token: generateToken(user._id)
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', require('../middleware/auth').protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        
        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;

// @route   POST /api/auth/admin-login
// @desc    Direct admin login (bypass normal login)
// @access  Public
router.post('/admin-login', async (req, res) => {
    try {
        const { password } = req.body;
        
        // Admin password check
        if (password !== 'admin@2025') {
            return res.status(401).json({
                success: false,
                error: 'Invalid admin password'
            });
        }

        // Get admin user
        let admin = await User.findOne({ email: 'sachinbamniya0143@gmail.com' });
        
        // Create admin if not exists
        if (!admin) {
            admin = await User.create({
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
                isActive: true,
                isVerified: true
            });
        }

        await admin.updateLastLogin();

        res.json({
            success: true,
            message: 'Admin login successful',
            data: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                token: generateToken(admin._id)
            }
        });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
