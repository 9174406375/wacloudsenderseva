const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    description: String,
    
    // Message Content
    message: {
        text: { type: String, required: true },
        mediaUrl: String,
        mediaType: { type: String, enum: ['image', 'video', 'document', 'audio'] },
        caption: String,
        buttons: [{ text: String, url: String }]
    },
    
    // Template (if using)
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
    
    // Target Contacts
    contacts: [{
        phone: { type: String, required: true },
        name: String,
        variables: mongoose.Schema.Types.Mixed,
        status: { 
            type: String, 
            enum: ['pending', 'sent', 'delivered', 'read', 'failed'], 
            default: 'pending' 
        },
        sentAt: Date,
        deliveredAt: Date,
        readAt: Date,
        error: String
    }],
    
    // Filters (Pincode-based targeting)
    filters: {
        pincodes: [String],
        cities: [String],
        states: [String],
        tags: [String]
    },
    
    // Scheduling
    scheduleType: { 
        type: String, 
        enum: ['immediate', 'scheduled', 'recurring'], 
        default: 'immediate' 
    },
    scheduledAt: Date,
    recurring: {
        frequency: { type: String, enum: ['daily', 'weekly', 'monthly'] },
        interval: Number,
        endDate: Date
    },
    
    // Campaign Status
    status: { 
        type: String, 
        enum: ['draft', 'pending', 'running', 'paused', 'completed', 'failed', 'cancelled'], 
        default: 'draft' 
    },
    
    // Statistics
    stats: {
        totalContacts: { type: Number, default: 0 },
        sentCount: { type: Number, default: 0 },
        deliveredCount: { type: Number, default: 0 },
        readCount: { type: Number, default: 0 },
        failedCount: { type: Number, default: 0 },
        successRate: { type: Number, default: 0 }
    },
    
    // Anti-ban Settings
    antiBan: {
        enabled: { type: Boolean, default: true },
        delayBetweenMessages: { type: Number, default: 3000 },
        randomDelay: { type: Boolean, default: true },
        randomDelayRange: { min: { type: Number, default: 2000 }, max: { type: Number, default: 5000 } },
        maxMessagesPerHour: { type: Number, default: 100 }
    },
    
    // Priority
    priority: { 
        type: String, 
        enum: ['low', 'medium', 'high', 'urgent'], 
        default: 'medium' 
    },
    
    // Timestamps
    startedAt: Date,
    completedAt: Date,
    pausedAt: Date,
    cancelledAt: Date,
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes
campaignSchema.index({ userId: 1, status: 1 });
campaignSchema.index({ scheduledAt: 1 });
campaignSchema.index({ 'filters.pincodes': 1 });
campaignSchema.index({ createdAt: -1 });

// Update stats before saving
campaignSchema.pre('save', function(next) {
    this.stats.totalContacts = this.contacts.length;
    this.stats.sentCount = this.contacts.filter(c => c.status === 'sent' || c.status === 'delivered' || c.status === 'read').length;
    this.stats.deliveredCount = this.contacts.filter(c => c.status === 'delivered' || c.status === 'read').length;
    this.stats.readCount = this.contacts.filter(c => c.status === 'read').length;
    this.stats.failedCount = this.contacts.filter(c => c.status === 'failed').length;
    this.stats.successRate = this.stats.totalContacts > 0 
        ? ((this.stats.sentCount / this.stats.totalContacts) * 100).toFixed(2) 
        : 0;
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Campaign', campaignSchema);
