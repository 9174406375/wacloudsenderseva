const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
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
        match: [/^[0-9]{10,15}$/, 'Please provide a valid phone number']
    },

    role: {
        type: String,
        enum: ['user', 'admin', 'superadmin'],
        default: 'user'
    },
    
    permissions: {
        type: [String],
        default: ['send_messages', 'bulk_send', 'manage_contacts']
    },

    isActive: {
        type: Boolean,
        default: true
    },
    
    isEmailVerified: {
        type: Boolean,
        default: false
    },

    passwordResetToken: String,
    passwordResetExpires: Date,
    passwordChangedAt: Date,

    avatar: String,
    bio: String,
    company: String,
    website: String,
    timezone: {
        type: String,
        default: 'Asia/Kolkata'
    },
    language: {
        type: String,
        enum: ['en', 'hi'],
        default: 'en'
    },

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
            messagesQuota: { type: Number, default: 1000 },
            contactsLimit: { type: Number, default: 10000 },
            templatesLimit: { type: Number, default: 10 },
            apiAccess: { type: Boolean, default: false }
        }
    },
    
    usage: {
        messagesUsed: { type: Number, default: 0 },
        lastResetDate: { type: Date, default: Date.now },
        totalMessagesSent: { type: Number, default: 0 }
    },

    whatsappSessions: [{
        sessionId: String,
        phoneNumber: String,
        name: String,
        isActive: { type: Boolean, default: false },
        isPrimary: { type: Boolean, default: false },
        connectedAt: Date,
        lastActivity: Date,
        qrCode: String,
        status: {
            type: String,
            enum: ['connected', 'disconnected', 'connecting', 'qr_pending'],
            default: 'disconnected'
        }
    }],

    security: {
        loginAttempts: { type: Number, default: 0 },
        lockUntil: Date,
        lastLogin: Date,
        lastLoginIP: String,
        twoFactorEnabled: { type: Boolean, default: false },
        twoFactorSecret: String
    },

    activity: {
        lastSeen: Date,
        totalLogins: { type: Number, default: 0 },
        campaignsCreated: { type: Number, default: 0 },
        contactsImported: { type: Number, default: 0 }
    },

    preferences: {
        emailNotifications: { type: Boolean, default: true },
        smsNotifications: { type: Boolean, default: false },
        campaignReports: { type: Boolean, default: true },
        weeklyDigest: { type: Boolean, default: true }
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
    }
});

// ═══════════════════════════════════════════════════════════════
// INDEXES - FIXED (No duplicates!)
// ═══════════════════════════════════════════════════════════════
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ 'security.lastLogin': -1 });
userSchema.index({ createdAt: -1 });

// ═══════════════════════════════════════════════════════════════
// VIRTUAL PROPERTIES
// ═══════════════════════════════════════════════════════════════
userSchema.virtual('isLocked').get(function() {
    return !!(this.security.lockUntil && this.security.lockUntil > Date.now());
});

userSchema.virtual('messagesRemaining').get(function() {
    return Math.max(0, this.subscription.features.messagesQuota - this.usage.messagesUsed);
});

// ═══════════════════════════════════════════════════════════════
// PRE-SAVE MIDDLEWARE
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════════════════
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

userSchema.methods.incLoginAttempts = async function() {
    if (this.security.lockUntil && this.security.lockUntil < Date.now()) {
        return await this.updateOne({
            $set: { 'security.loginAttempts': 1 },
            $unset: { 'security.lockUntil': 1 }
        });
    }
    const updates = { $inc: { 'security.loginAttempts': 1 } };
    if (this.security.loginAttempts + 1 >= 5) {
        updates.$set = { 'security.lockUntil': Date.now() + (2 * 60 * 60 * 1000) };
    }
    return await this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = async function() {
    return await this.updateOne({
        $set: { 'security.loginAttempts': 0 },
        $unset: { 'security.lockUntil': 1 }
    });
};

userSchema.methods.updateLastLogin = async function(ip) {
    this.security.lastLogin = Date.now();
    this.security.lastLoginIP = ip;
    this.activity.lastSeen = Date.now();
    this.activity.totalLogins += 1;
    return await this.save();
};

userSchema.methods.canSendMessage = function(count = 1) {
    if (!this.isActive) return { allowed: false, reason: 'Account inactive' };
    if (this.isLocked) return { allowed: false, reason: 'Account locked' };
    const remaining = this.messagesRemaining;
    if (remaining < count) return { allowed: false, reason: `Insufficient quota (${remaining} remaining)` };
    return { allowed: true };
};

userSchema.methods.incrementMessagesUsed = async function(count = 1) {
    this.usage.messagesUsed += count;
    this.usage.totalMessagesSent += count;
    return await this.save();
};

module.exports = mongoose.model('User', userSchema);
