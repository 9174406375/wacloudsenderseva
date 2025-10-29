const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Basic Info
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    email: String,
    alternatePhone: String,
    
    // WhatsApp Details
    whatsapp: {
        number: String,
        isWhatsApp: { type: Boolean, default: true },
        lastMessageAt: Date,
        totalMessagesSent: { type: Number, default: 0 }
    },
    
    // Location (Pincode System)
    location: {
        address: String,
        pincode: String,
        city: String,
        district: String,
        state: String,
        country: { type: String, default: 'India' }
    },
    
    // Tags & Groups
    tags: [String],
    groups: [String],
    lists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ContactList' }],
    
    // Custom Fields
    customFields: mongoose.Schema.Types.Mixed,
    
    // Engagement
    engagement: {
        lastContactedAt: Date,
        totalCampaigns: { type: Number, default: 0 },
        totalOrders: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
        optedOut: { type: Boolean, default: false }
    },
    
    // Notes
    notes: String,
    
    // Source
    source: {
        type: String,
        enum: ['manual', 'import', 'whatsapp', 'order', 'campaign'],
        default: 'manual'
    },
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes
contactSchema.index({ userId: 1, phone: 1 }, { unique: true });
contactSchema.index({ 'location.pincode': 1 });
contactSchema.index({ tags: 1 });
contactSchema.index({ 'engagement.isActive': 1 });

// Update timestamp
contactSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Contact', contactSchema);
