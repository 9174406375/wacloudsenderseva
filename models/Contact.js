const mongoose = require('mongoose');

/**
 * ═══════════════════════════════════════════════════════════════
 * CONTACT MODEL - Individual Contact Management
 * ═══════════════════════════════════════════════════════════════
 */

const contactSchema = new mongoose.Schema({
    // ═══ OWNER ═══
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // ═══ BASIC INFO ═══
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required'],
        match: [/^[0-9]{10,15}$/, 'Invalid phone number format'],
        index: true
    },
    
    name: {
        type: String,
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    
    email: {
        type: String,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
    },
    
    avatar: String,

    // ═══ ADDITIONAL INFO ═══
    company: String,
    jobTitle: String,
    website: String,
    
    address: {
        street: String,
        city: String,
        state: String,
        country: String,
        zipCode: String
    },

    // ═══ CATEGORIZATION ═══
    tags: [String],
    
    lists: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ContactList'
    }],
    
    customFields: mongoose.Schema.Types.Mixed,

    // ═══ COMMUNICATION STATUS ═══
    status: {
        type: String,
        enum: ['active', 'inactive', 'blocked', 'unsubscribed', 'invalid'],
        default: 'active',
        index: true
    },
    
    whatsappStatus: {
        isRegistered: {
            type: Boolean,
            default: true
        },
        lastChecked: Date,
        profilePic: String
    },

    // ═══ ENGAGEMENT ═══
    engagement: {
        totalMessagesSent: {
            type: Number,
            default: 0
        },
        totalMessagesReceived: {
            type: Number,
            default: 0
        },
        lastMessageSent: Date,
        lastMessageReceived: Date,
        lastInteraction: Date,
        
        campaignsReceived: {
            type: Number,
            default: 0
        },
        
        responseRate: {
            type: Number,
            default: 0
        }
    },

    // ═══ PREFERENCES ═══
    preferences: {
        language: {
            type: String,
            default: 'en'
        },
        timezone: String,
        optedIn: {
            type: Boolean,
            default: true
        },
        unsubscribedAt: Date,
        doNotDisturb: {
            type: Boolean,
            default: false
        }
    },

    // ═══ SOURCE ═══
    source: {
        type: {
            type: String,
            enum: ['manual', 'import', 'api', 'form', 'integration'],
            default: 'manual'
        },
        campaign: String,
        referrer: String,
        importBatch: String
    },

    // ═══ NOTES & HISTORY ═══
    notes: [{
        text: String,
        addedBy: mongoose.Schema.Types.ObjectId,
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],

    // ═══ TIMESTAMPS ═══
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// ═══════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════
contactSchema.index({ user: 1, phoneNumber: 1 }, { unique: true });
contactSchema.index({ user: 1, status: 1 });
contactSchema.index({ tags: 1 });
contactSchema.index({ 'engagement.lastInteraction': -1 });

// ═══════════════════════════════════════════════════════════════
// VIRTUAL PROPERTIES
// ═══════════════════════════════════════════════════════════════

// Full WhatsApp number
contactSchema.virtual('whatsappNumber').get(function() {
    return this.phoneNumber + '@s.whatsapp.net';
});

// Is active
contactSchema.virtual('isActive').get(function() {
    return this.status === 'active' && this.preferences.optedIn;
});

// Days since last interaction
contactSchema.virtual('daysSinceLastInteraction').get(function() {
    if (!this.engagement.lastInteraction) return null;
    return Math.floor((Date.now() - this.engagement.lastInteraction) / (1000 * 60 * 60 * 24));
});

// ═══════════════════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════════════════

// Update engagement
contactSchema.methods.updateEngagement = async function(type, direction) {
    if (direction === 'sent') {
        this.engagement.totalMessagesSent += 1;
        this.engagement.lastMessageSent = Date.now();
    } else {
        this.engagement.totalMessagesReceived += 1;
        this.engagement.lastMessageReceived = Date.now();
    }
    this.engagement.lastInteraction = Date.now();
    return await this.save();
};

// Add note
contactSchema.methods.addNote = async function(text, userId) {
    this.notes.push({
        text,
        addedBy: userId,
        addedAt: Date.now()
    });
    return await this.save();
};

// Unsubscribe
contactSchema.methods.unsubscribe = async function() {
    this.status = 'unsubscribed';
    this.preferences.optedIn = false;
    this.preferences.unsubscribedAt = Date.now();
    return await this.save();
};

// Resubscribe
contactSchema.methods.resubscribe = async function() {
    this.status = 'active';
    this.preferences.optedIn = true;
    this.preferences.unsubscribedAt = null;
    return await this.save();
};

// ═══════════════════════════════════════════════════════════════
// STATIC METHODS
// ═══════════════════════════════════════════════════════════════

// Find by phone
contactSchema.statics.findByPhone = function(userId, phoneNumber) {
    return this.findOne({ user: userId, phoneNumber });
};

// Find active contacts
contactSchema.statics.findActive = function(userId) {
    return this.find({ 
        user: userId, 
        status: 'active',
        'preferences.optedIn': true 
    });
};

// Bulk import
contactSchema.statics.bulkImport = async function(userId, contacts) {
    const operations = contacts.map(contact => ({
        updateOne: {
            filter: { user: userId, phoneNumber: contact.phoneNumber },
            update: { $set: { ...contact, user: userId } },
            upsert: true
        }
    }));
    
    return await this.bulkWrite(operations);
};

module.exports = mongoose.model('Contact', contactSchema);
