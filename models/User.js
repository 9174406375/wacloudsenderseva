const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    role: { 
        type: String, 
        enum: ['user', 'admin', 'superadmin'], 
        default: 'user' 
    },
    
    // WhatsApp Connection
    whatsapp: {
        connected: { type: Boolean, default: false },
        number: String,
        qrCode: String,
        pairingCode: String,
        sessionData: mongoose.Schema.Types.Mixed,
        lastConnected: Date,
        connectionAttempts: { type: Number, default: 0 }
    },
    
    // Admin Permissions
    permissions: {
        canCreateCampaigns: { type: Boolean, default: true },
        canImportContacts: { type: Boolean, default: true },
        canUseTemplates: { type: Boolean, default: false },
        canAccessAnalytics: { type: Boolean, default: false },
        canManageOrders: { type: Boolean, default: false },
        canAccessAdmin: { type: Boolean, default: false },
        maxCampaignsPerDay: { type: Number, default: 10 },
        maxContactsPerCampaign: { type: Number, default: 1000 },
        maxOrdersPerDay: { type: Number, default: 100 }
    },
    
    // Subscription
    subscription: {
        plan: { 
            type: String, 
            enum: ['free', 'basic', 'pro', 'enterprise'], 
            default: 'free' 
        },
        startDate: Date,
        endDate: Date,
        isActive: { type: Boolean, default: true },
        features: [String]
    },
    
    // Location (Pincode System)
    location: {
        pincode: String,
        city: String,
        district: String,
        state: String,
        country: { type: String, default: 'India' },
        address: String
    },
    
    // Usage Statistics
    stats: {
        totalCampaigns: { type: Number, default: 0 },
        totalMessagesSent: { type: Number, default: 0 },
        totalContacts: { type: Number, default: 0 },
        totalOrders: { type: Number, default: 0 },
        totalTemplates: { type: Number, default: 0 },
        lastLoginAt: Date,
        lastActivityAt: Date
    },
    
    // Account Status
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    verificationToken: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ 'whatsapp.number': 1 });
userSchema.index({ 'location.pincode': 1 });
userSchema.index({ role: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    this.updatedAt = Date.now();
    next();
});

// Match password
userSchema.methods.matchPassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

// Update last login
userSchema.methods.updateLastLogin = async function() {
    this.stats.lastLoginAt = new Date();
    this.stats.lastActivityAt = new Date();
    await this.save();
};

// Check if user can perform action
userSchema.methods.canPerformAction = function(action) {
    if (this.role === 'superadmin') return true;
    if (this.role === 'admin') return this.permissions.canAccessAdmin;
    return this.permissions[action] || false;
};

module.exports = mongoose.model('User', userSchema);
