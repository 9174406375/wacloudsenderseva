const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    name: { type: String, required: true, trim: true },
    description: String,
    category: { 
        type: String, 
        enum: ['order_confirmation', 'delivery_update', 'marketing', 'greeting', 'notification', 'custom'],
        default: 'custom'
    },
    
    // Template Content
    content: {
        text: { type: String, required: true },
        variables: [{ name: String, placeholder: String, defaultValue: String }],
        mediaUrl: String,
        mediaType: { type: String, enum: ['image', 'video', 'document'] },
        buttons: [{ text: String, url: String }]
    },
    
    // Language
    language: { 
        type: String, 
        enum: ['Hindi', 'English', 'Punjabi', 'Bengali', 'Marathi'], 
        default: 'Hindi' 
    },
    
    // Template Settings
    isPublic: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    
    // Usage Stats
    usageCount: { type: Number, default: 0 },
    lastUsedAt: Date,
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes
templateSchema.index({ userId: 1, category: 1 });
templateSchema.index({ isPublic: 1, isActive: 1 });

module.exports = mongoose.model('Template', templateSchema);
