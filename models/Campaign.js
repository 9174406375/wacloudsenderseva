const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    targetGroup: {
        type: String
    },
    targetCity: {
        type: String
    },
    totalMessages: {
        type: Number,
        default: 0
    },
    sentMessages: {
        type: Number,
        default: 0
    },
    failedMessages: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['pending', 'running', 'completed', 'paused', 'cancelled'],
        default: 'pending'
    },
    scheduledAt: {
        type: Date
    },
    startedAt: {
        type: Date
    },
    completedAt: {
        type: Date
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Campaign', campaignSchema);
