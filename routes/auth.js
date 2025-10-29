const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

// Send token response
const sendTokenResponse = (user, statusCode, res) => {
    const token = generateToken(user._id);
    
    const options = {
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    };
    
    res.status(statusCode)
        .cookie('token', token, options)
        .json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                whatsapp: user.whatsapp
            }
        });
};

// @route   POST /api/auth/register
// @desc    Register new user
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name, email and password'
            });
        }
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }
        
        const user = await User.create({
            name,
            email,
            password,
            phone
        });
        
        console.log(`✅ New user registered: ${email}`);
        
        sendTokenResponse(user, 201, res);
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Error registering user',
            error: error.message
        });
    }
});

// @route   POST /api/auth/login
// @desc    Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }
        
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        const isMatch = await user.comparePassword(password);
        
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        user.lastLogin = Date.now();
        await user.save();
        
        console.log(`✅ User logged in: ${email}`);
        
        sendTokenResponse(user, 200, res);
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Error logging in',
            error: error.message
        });
    }
});

// @route   GET /api/auth/google
// @desc    Start Google OAuth
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

// @route   GET /api/auth/google/callback
// @desc    Google OAuth callback
router.get('/google/callback',
    passport.authenticate('google', { 
        failureRedirect: '/login?error=google_auth_failed',
        session: false 
    }),
    (req, res) => {
        req.user.lastLogin = Date.now();
        req.user.save();
        
        const token = generateToken(req.user._id);
        
        console.log(`✅ User logged in via Google: ${req.user.email}`);
        
        // Redirect to frontend dashboard with token
        res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard?token=${token}`);
    }
);

// @route   GET /api/auth/me
// @desc    Get current user
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        
        res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching user data'
        });
    }
});

// @route   POST /api/auth/logout
// @desc    Logout user
router.post('/logout', protect, (req, res) => {
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });
    
    res.status(200).json({
        success: true,
        message: 'Logged out successfully'
    });
});

// @route   POST /api/auth/forgotpassword
// @desc    Forgot password
router.post('/forgotpassword', async (req, res) => {
    try {
        const { email } = req.body;
        
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        const resetToken = user.getResetPasswordToken();
        await user.save();
        
        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;
        
        console.log(`🔐 Password reset requested for: ${email}`);
        console.log(`Reset URL: ${resetUrl}`);
        
        res.status(200).json({
            success: true,
            message: 'Password reset link sent',
            resetToken // Remove in production
        });
        
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing request'
        });
    }
});

// @route   PUT /api/auth/resetpassword/:resetToken
// @desc    Reset password
router.put('/resetpassword/:resetToken', async (req, res) => {
    try {
        const { password } = req.body;
        
        if (!password || password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }
        
        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(req.params.resetToken)
            .digest('hex');
        
        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });
        
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }
        
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();
        
        console.log(`✅ Password reset successful for: ${user.email}`);
        
        sendTokenResponse(user, 200, res);
        
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Error resetting password'
        });
    }
});

module.exports = router;
