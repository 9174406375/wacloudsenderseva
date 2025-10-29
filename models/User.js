const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * ═══════════════════════════════════════════════════════════════
 * USER SCHEMA - ENTERPRISE VERSION
 * Complete user management with all production features
 * ═══════════════════════════════════════════════════════════════
 */

const userSchema = new mongoose.Schema({
    // ═══ BASIC INFORMATION ═══
    name: {
        type: String,
        required: [true, 'Please provide your name'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters'],
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
        index: true
    },
    
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false
    },
    
    phone: {
        type: String,
        required: [true, 'Please provide a phone number'],
        match: [/^[0-9]{10,15}$/, 'Please provide a valid phone number'],
        index: true
    },

    // ═══ ROLE & PERMISSIONS ═══
    role: {
        type: String,
        enum: {
            values: ['user', 'admin', 'superadmin'],
            message: 'Role must be either user, admin, or superadmin'
        },
        default: 'user',
        index: true
    },
    
    permissions: {
        type: [{
            type: String,
            enum: [
                'send_messages',
                'bulk_send', 
                'manage_contacts',
                'view_analytics',
                'manage_users',
                'manage_templates',
                'export_data',
                'api_access'
            ]
        }],
        default: ['send_messages', 'bulk_send', 'manage_contacts']
    },

    // ═══ ACCOUNT STATUS ═══
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    
    emailVerificationToken: {
        type: String,
        select: false
    },
    
    emailVerificationExpires: {
        type: Date,
        select: false
    },

    // ═══ PASSWORD RESET ═══
    passwordResetToken: {
        type: String,
        select: false
    },
    
    passwordResetExpires: {
        type: Date,
        select: false
    },
    
    passwordChangedAt: Date,

    // ═══ PROFILE ═══
    avatar: {
        type: String,
        default: null
    },
    
    bio: {
        type: String,
        maxlength: [500, 'Bio cannot exceed 500 characters']
    },
    
    company: {
        type: String,
        maxlength: [100, 'Company name cannot exceed 100 characters']
    },
    
    website: {
        type: String,
        match: [/^https?:\/\//, 'Please provide a valid URL']
    },
    
    timezone: {
        type: String,
        default: 'Asia/Kolkata'
    },
    
    language: {
        type: String,
        enum: ['en', 'hi'],
        default: 'en'
    },

    // ═══ USAGE & LIMITS ═══
    subscription: {
        plan: {
            type: String,
            enum: ['free', 'basic', 'pro', 'enterprise'],
            default: 'free'
        },
        status: {
            type: String,
            enum: ['active', 'cancelled', 'expired', 'trial'],
            default: 'active'
        },
        startDate: {
            type: Date,
            default: Date.now
        },
        endDate: Date,
        features: {
            messagesQuota: {
                type: Number,
                default: 1000
            },
            contactsLimit: {
                type: Number,
                default: 10000
            },
            templatesLimit: {
                type: Number,
                default: 10
            },
            apiAccess: {
                type: Boolean,
                default: false
            }
        }
    },
    
    usage: {
        messagesUsed: {
            type: Number,
            default: 0
        },
        lastResetDate: {
            type: Date,
            default: Date.now
        },
        totalMessagesSent: {
            type: Number,
            default: 0
        }
    },

    // ═══ WHATSAPP SESSIONS ═══
    whatsappSessions: [{
        sessionId: {
            type: String,
            required: true
        },
        phoneNumber: String,
        name: String,
        isActive: {
            type: Boolean,
            default: false
        },
        isPrimary: {
            type: Boolean,
            default: false
        },
        connectedAt: Date,
        lastActivity: Date,
        qrCode: String,
        status: {
            type: String,
            enum: ['connected', 'disconnected', 'connecting', 'qr_pending'],
            default: 'disconnected'
        }
    }],

    // ═══ SECURITY ═══
    security: {
        loginAttempts: {
            type: Number,
            default: 0
        },
        lockUntil: Date,
        lastLogin: Date,
        lastLoginIP: String,
        twoFactorEnabled: {
            type: Boolean,
            default: false
        },
        twoFactorSecret: {
            type: String,
            select: false
        }
    },

    // ═══ ACTIVITY TRACKING ═══
    activity: {
        lastSeen: Date,
        totalLogins: {
            type: Number,
            default: 0
        },
        campaignsCreated: {
            type: Number,
            default: 0
        },
        contactsImported: {
            type: Number,
            default: 0
        }
    },

    // ═══ PREFERENCES ═══
    preferences: {
        emailNotifications: {
            type: Boolean,
            default: true
        },
        smsNotifications: {
            type: Boolean,
            default: false
        },
        campaignReports: {
            type: Boolean,
            default: true
        },
        weeklyDigest: {
            type: Boolean,
            default: true
        }
    },

    // ═══ TIMESTAMPS ═══
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { 
        virtuals: true,
        transform: function(doc, ret) {
            delete ret.password;
            delete ret.__v;
            return ret;
        }
    },
    toObject: { virtuals: true }
});

// ═══════════════════════════════════════════════════════════════
// INDEXES FOR PERFORMANCE
// ═══════════════════════════════════════════════════════════════
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ 'security.lastLogin': -1 });
userSchema.index({ createdAt: -1 });

// ═══════════════════════════════════════════════════════════════
// VIRTUAL PROPERTIES
// ═══════════════════════════════════════════════════════════════

// Check if account is locked
userSchema.virtual('isLocked').get(function() {
    return !!(this.security.lockUntil && this.security.lockUntil > Date.now());
});

// Messages remaining this month
userSchema.virtual('messagesRemaining').get(function() {
    return Math.max(0, this.subscription.features.messagesQuota - this.usage.messagesUsed);
});

// Subscription days remaining
userSchema.virtual('subscriptionDaysLeft').get(function() {
    if (!this.subscription.endDate) return null;
    const diff = this.subscription.endDate - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

// ═══════════════════════════════════════════════════════════════
// PRE-SAVE MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        
        if (!this.isNew) {
            this.passwordChangedAt = Date.now() - 1000;
        }
        
        next();
    } catch (error) {
        next(error);
    }
});

// Update timestamps
userSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// ═══════════════════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════════════════

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
    const token = crypto.randomBytes(32).toString('hex');
    this.emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
    this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
    return token;
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
    const token = crypto.randomBytes(32).toString('hex');
    this.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
    this.passwordResetExpires = Date.now() + 60 * 60 * 1000;
    return token;
};

// Check if password changed after JWT issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

// Increment login attempts
userSchema.methods.incLoginAttempts = async function() {
    if (this.security.lockUntil && this.security.lockUntil < Date.now()) {
        return await this.updateOne({
            $set: { 'security.loginAttempts': 1 },
            $unset: { 'security.lockUntil': 1 }
        });
    }

    const updates = { $inc: { 'security.loginAttempts': 1 } };
    const maxAttempts = 5;
    const lockTime = 2 * 60 * 60 * 1000;
    
    if (this.security.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
        updates.$set = { 'security.lockUntil': Date.now() + lockTime };
    }

    return await this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = async function() {
    return await this.updateOne({
        $set: { 'security.loginAttempts': 0 },
        $unset: { 'security.lockUntil': 1 }
    });
};

// Update last login
userSchema.methods.updateLastLogin = async function(ip) {
    this.security.lastLogin = Date.now();
    this.security.lastLoginIP = ip;
    this.activity.lastSeen = Date.now();
    this.activity.totalLogins += 1;
    return await this.save();
};

// Check if can send message
userSchema.methods.canSendMessage = function(count = 1) {
    if (!this.isActive) return { allowed: false, reason: 'Account inactive' };
    if (this.isLocked) return { allowed: false, reason: 'Account locked' };
    if (this.subscription.status !== 'active') return { allowed: false, reason: 'Subscription inactive' };
    
    const remaining = this.messagesRemaining;
    if (remaining < count) return { allowed: false, reason: `Insufficient quota (${remaining} remaining)` };
    
    return { allowed: true };
};

// Increment messages used
userSchema.methods.incrementMessagesUsed = async function(count = 1) {
    this.usage.messagesUsed += count;
    this.usage.totalMessagesSent += count;
    return await this.save();
};

// Reset monthly usage
userSchema.methods.resetMonthlyUsage = async function() {
    this.usage.messagesUsed = 0;
    this.usage.lastResetDate = Date.now();
    return await this.save();
};

// Add WhatsApp session
userSchema.methods.addWhatsAppSession = async function(sessionData) {
    this.whatsappSessions.push(sessionData);
    return await this.save();
};

// Update WhatsApp session
userSchema.methods.updateWhatsAppSession = async function(sessionId, updates) {
    const session = this.whatsappSessions.find(s => s.sessionId === sessionId);
    if (session) {
        Object.assign(session, updates);
        return await this.save();
    }
    return null;
};

// Remove WhatsApp session
userSchema.methods.removeWhatsAppSession = async function(sessionId) {
    this.whatsappSessions = this.whatsappSessions.filter(s => s.sessionId !== sessionId);
    return await this.save();
};

// ═══════════════════════════════════════════════════════════════
// STATIC METHODS
// ═══════════════════════════════════════════════════════════════

// Find by email
userSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

// Find active users
userSchema.statics.findActive = function() {
    return this.find({ isActive: true });
};

// Find by role
userSchema.statics.findByRole = function(role) {
    return this.find({ role });
};

// Get user stats
userSchema.statics.getStats = async function() {
    return await this.aggregate([
        {
            $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
                totalMessagesSent: { $sum: '$usage.totalMessagesSent' }
            }
        }
    ]);
};

module.exports = mongoose.model('User', userSchema);
