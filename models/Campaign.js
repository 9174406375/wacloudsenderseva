const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    message: { type: String, required: true },
    contacts: [{
        phone: String,
        name: String,
        status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
        sentAt: Date
    }],
    scheduleType: { type: String, enum: ['immediate', 'scheduled'], default: 'immediate' },
    scheduledAt: Date,
    status: { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' },
    totalContacts: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    delayBetweenMessages: { type: Number, default: 3000 },
    createdAt: { type: Date, default: Date.now },
    completedAt: Date
});

module.exports = mongoose.model('Campaign', campaignSchema);
