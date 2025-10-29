/**
 * ═══════════════════════════════════════════════════════════════
 * AUTHENTICATION ROUTES - WA Cloud Sender Seva
 * Complete user authentication system with security features
 * Endpoints: Register, Login, Profile, Password Management
 * ═══════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, generateToken } = require('../middleware/auth');

// Admin contact details for notifications
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'sachinbamniya0143@gmail.com';
const ADMIN_PHONE = process.env.ADMIN_PHONE || '+917440637593';

/**
 * ═══════════════════════════════════════════════════════════════
 * REGISTER NEW USER
 * POST /api/auth/register
 * Public route
 * ═══════════════════════════════════════════════════════════════
 */
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        // ═══ Input Validation ═══
        if (!name || !email || !password || !phone) {
            return res.status(400).json({
                success: false,
                error: 'All fields are required',
                required: ['name', 'email', 'password', 'phone']
            });
        }

        // Validate email format
        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format. Please provide a valid email address.'
            });
        }

        // Validate phone number (10-15 digits)
        const phoneRegex = /^[0-9]{10,15}$/;
        const cleanPhone = phone.replace(/\D/g, ''); // Remove non-digits
        if (!phoneRegex.test(cleanPhone)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number. Must be 10-15 digits.',
                example: '9174063759'
            });
        }

        // Validate password strength
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 6 characters long'
            });
        }

        // ═══ Check for Existing User ═══
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'User already exists with this email address',
                suggestion: 'Try logging in or use a different email'
            });
        }

        // Check if phone number already exists
        const existingPhone = await User.findOne({ phone: cleanPhone });
        if (existingPhone) {
            return res.status(400).json({
                success: false,
                error: 'Phone number already registered'
            });
        }

        // ═══ Create New User ═══
        const user = await User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password, // Will be hashed by User model pre-save hook
            phone: cleanPhone,
            role: 'user',
            permissions: ['send_messages', 'bulk_send', 'manage_contacts', 'view_analytics'],
            subscription: {
                plan: 'free',
                status: 'active',
                startDate: Date.now(),
                features: {
                    messagesQuota: 1000,
                    contactsLimit: 10000,
                    templatesLimit: 10,
                    apiAccess: false
                }
            }
        });

        // Generate JWT token
        const token = generateToken(user._id);

        // TODO: Send welcome email to user
        // TODO: Send notification to admin about new registration

        // Send success response
        res.status(201).json({
            success: true,
            message: 'Registration successful! Welcome to WA Cloud Sender Seva.',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                subscription: {
                    plan: user.subscription.plan,
                    messagesQuota: user.subscription.features.messagesQuota,
                    messagesUsed: user.usage.messagesUsed,
                    messagesRemaining: user.subscription.features.messagesQuota - user.usage.messagesUsed
                },
                permissions: user.permissions,
                createdAt: user.createdAt
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        
        // Handle mongoose validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: messages
            });
        }

        res.status(500).json({
            success: false,
            error: 'Registration failed. Please try again.',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * ═══════════════════════════════════════════════════════════════
 * LOGIN USER
 * POST /api/auth/login
 * Public route
 * ═══════════════════════════════════════════════════════════════
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // ═══ Input Validation ═══
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Please provide both email and password'
            });
        }

        // ═══ Find User (include password for verification) ═══
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        // ═══ Security Checks ═══

        // Check if account is locked
        if (user.isLocked) {
            const lockUntil = user.security.lockUntil;
            const minutesRemaining = Math.ceil((lockUntil - Date.now()) / 60000);
            
            return res.status(401).json({
                success: false,
                error: 'Account temporarily locked',
                message: `Too many failed login attempts. Try again in ${minutesRemaining} minutes.`,
                lockUntil: user.security.lockUntil
            });
        }

        // Check if account is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                error: 'Account is inactive',
                message: 'Your account has been deactivated. Please contact support.',
                supportEmail: ADMIN_EMAIL
            });
        }

        // ═══ Verify Password ═══
        const isPasswordCorrect = await user.comparePassword(password);

        if (!isPasswordCorrect) {
            // Increment failed login attempts
            await user.incLoginAttempts();

            return res.status(401).json({
                success: false,
                error: 'Invalid email or password',
                warning: user.security.loginAttempts >= 4 ? 
                    'Account will be locked after one more failed attempt' : undefined
            });
        }

        // ═══ Successful Login ═══

        // Reset login attempts on successful login
        await user.resetLoginAttempts();

        // Update last login information
        const clientIP = req.ip || req.connection.remoteAddress;
        await user.updateLastLogin(clientIP);

        // Generate JWT token
        const token = generateToken(user._id);

        // Send success response
        res.json({
            success: true,
            message: 'Login successful!',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                avatar: user.avatar,
                subscription: {
                    plan: user.subscription.plan,
                    status: user.subscription.status,
                    messagesQuota: user.subscription.features.messagesQuota,
                    messagesUsed: user.usage.messagesUsed,
                    messagesRemaining: user.messagesRemaining,
                    contactsLimit: user.subscription.features.contactsLimit
                },
                permissions: user.permissions,
                whatsappSessions: user.whatsappSessions.length,
                lastLogin: user.security.lastLogin
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed. Please try again.'
        });
    }
});

/**
 * ═══════════════════════════════════════════════════════════════
 * GET CURRENT USER PROFILE
 * GET /api/auth/me
 * Protected route (requires JWT token)
 * ═══════════════════════════════════════════════════════════════
 */
router.get('/me', protect, async (req, res) => {
    try {
        // User is already attached to req by protect middleware
        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch profile'
        });
    }
});

/**
 * ═══════════════════════════════════════════════════════════════
 * UPDATE USER PROFILE
 * PUT /api/auth/profile
 * Protected route
 * ═══════════════════════════════════════════════════════════════
 */
router.put('/profile', protect, async (req, res) => {
    try {
        // Fields allowed to be updated
        const allowedUpdates = [
            'name', 'phone', 'bio', 'company', 'website',
            'timezone', 'language', 'avatar', 'preferences'
        ];

        // Build update object
        const updates = {};
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        // Check if there are any valid updates
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid fields to update',
                allowedFields: allowedUpdates
            });
        }

        // Update user
        const user = await User.findByIdAndUpdate(
            req.userId,
            updates,
            {
                new: true, // Return updated document
                runValidators: true // Run model validators
            }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: user
        });

    } catch (error) {
        console.error('Update profile error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: messages
            });
        }

        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update profile'
        });
    }
});

/**
 * ═══════════════════════════════════════════════════════════════
 * CHANGE PASSWORD
 * PUT /api/auth/change-password
 * Protected route
 * ═══════════════════════════════════════════════════════════════
 */
router.put('/change-password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        // ═══ Input Validation ═══
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'New password must be at least 6 characters long'
            });
        }

        if (confirmPassword && newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                error: 'New password and confirm password do not match'
            });
        }

        // ═══ Get User with Password ═══
        const user = await User.findById(req.userId).select('+password');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // ═══ Verify Current Password ═══
        const isCurrentPasswordCorrect = await user.comparePassword(currentPassword);

        if (!isCurrentPasswordCorrect) {
            return res.status(401).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }

        // ═══ Update Password ═══
        user.password = newPassword; // Will be hashed by pre-save hook
        await user.save();

        // Generate new token (invalidates old tokens implicitly)
        const token = generateToken(user._id);

        res.json({
            success: true,
            message: 'Password changed successfully. Please login with your new password.',
            token
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to change password'
        });
    }
});

/**
 * ═══════════════════════════════════════════════════════════════
 * LOGOUT
 * POST /api/auth/logout
 * Protected route
 * ═══════════════════════════════════════════════════════════════
 */
router.post('/logout', protect, async (req, res) => {
    try {
        // Update user's last activity
        await User.findByIdAndUpdate(req.userId, {
            'activity.lastSeen': Date.now()
        });

        // Note: JWT is stateless, so actual logout happens client-side
        // by removing the token from localStorage/cookies

        res.json({
            success: true,
            message: 'Logged out successfully. Token should be removed from client.'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Logout failed'
        });
    }
});

module.exports = router;
