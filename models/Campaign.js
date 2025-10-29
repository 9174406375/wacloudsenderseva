const mongoose = require('mongoose');

/**
 * ═══════════════════════════════════════════════════════════════
 * CAMPAIGN MODEL - WhatsApp Bulk Messaging Campaigns
 * Complete campaign management with analytics
 * ═══════════════════════════════════════════════════════════════
 */

const campaignSchema = new mongoose.Schema({
    // ═══ BASIC INFORMATION ═══
    name: {
        type: String,
        required: [true, 'Campaign name is required'],
        trim: true,
        maxlength: [100, 'Campaign name cannot exceed 100 characters']
    },
    
    description: {
        type: String,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // ═══ CAMPAIGN STATUS ═══
    status: {
        type: String,
        enum: {
            values: ['draft', 'scheduled', 'running', 'paused', 'completed', 'failed', 'cancelled'],
            message: 'Invalid campaign status'
        },
        default: 'draft',
        index: true
    },
    
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },

    // ═══ MESSAGE CONTENT ═══
    message: {
        type: {
            type: String,
            enum: ['text', 'image', 'document', 'video', 'template'],
            required: true,
            default: 'text'
        },
        
        text: {
            type: String,
            required: true,
            maxlength: [4096, 'Message cannot exceed 4096 characters']
        },
        
        mediaUrl: String,
        
        caption: {
            type: String,
            maxlength: [1024, 'Caption cannot exceed 1024 characters']
        },
        
        templateId: String,
        
        variables: [{
            key: String,
            value: String
        }],
        
        buttons: [{
            type: {
                type: String,
                enum: ['url', 'call', 'reply']
            },
            text: String,
            value: String
        }]
    },

    // ═══ TARGETING ═══
    targeting: {
        contactLists: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ContactList'
        }],
        
        contactIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Contact'
        }],
        
        totalContacts: {
            type: Number,
            default: 0
        },
        
        filters: {
            tags: [String],
            customFields: mongoose.Schema.Types.Mixed
        }
    },

    // ═══ SCHEDULING ═══
    schedule: {
        type: {
            type: String,
            enum: ['immediate', 'scheduled', 'recurring'],
            default: 'immediate'
        },
        
        startDate: Date,
        
        endDate: Date,
        
        timezone: {
            type: String,
            default: 'Asia/Kolkata'
        },
        
        recurring: {
            enabled: {
                type: Boolean,
                default: false
            },
            frequency: {
                type: String,
                enum: ['daily', 'weekly', 'monthly']
            },
            interval: Number,
            daysOfWeek: [Number],
            time: String
        }
    },

    // ═══ DELIVERY SETTINGS ═══
    delivery: {
        method: {
            type: String,
            enum: ['sequential', 'parallel', 'throttled'],
            default: 'throttled'
        },
        
        rateLimit: {
            messagesPerMinute: {
                type: Number,
                default: 20,
                min: 1,
                max: 60
            },
            messagesPerHour: {
                type: Number,
                default: 1000
            }
        },
        
        retryPolicy: {
            enabled: {
                type: Boolean,
                default: true
            },
            maxRetries: {
                type: Number,
                default: 3,
                min: 0,
                max: 5
            },
            retryDelay: {
                type: Number,
                default: 300000
            }
        },
        
        whatsappSession: {
            type: String,
            required: true
        }
    },

    // ═══ STATISTICS & ANALYTICS ═══
    stats: {
        total: {
            type: Number,
            default: 0
        },
        sent: {
            type: Number,
            default: 0
        },
        delivered: {
            type: Number,
            default: 0
        },
        read: {
            type: Number,
            default: 0
        },
        failed: {
            type: Number,
            default: 0
        },
        pending: {
            type: Number,
            default: 0
        },
        
        deliveryRate: {
            type: Number,
            default: 0
        },
        
        readRate: {
            type: Number,
            default: 0
        },
        
        failureRate: {
            type: Number,
            default: 0
        },
        
        averageDeliveryTime: Number,
        
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    },

    // ═══ EXECUTION TRACKING ═══
    execution: {
        startedAt: Date,
        completedAt: Date,
        pausedAt: Date,
        cancelledAt: Date,
        
        currentBatch: {
            type: Number,
            default: 0
        },
        
        totalBatches: {
            type: Number,
            default: 0
        },
        
        processedContacts: {
            type: Number,
            default: 0
        },
        
        errors: [{
            timestamp: Date,
            contactId: mongoose.Schema.Types.ObjectId,
            phoneNumber: String,
            error: String,
            errorCode: String
        }],
        
        estimatedCompletionTime: Date
    },

    // ═══ BUDGET & COSTS ═══
    budget: {
        maxMessages: Number,
        messagesUsed: {
            type: Number,
            default: 0
        },
        costPerMessage: {
            type: Number,
            default: 0
        },
        totalCost: {
            type: Number,
            default: 0
        }
    },

    // ═══ ADVANCED FEATURES ═══
    features: {
        personalization: {
            enabled: {
                type: Boolean,
                default: false
            },
            fields: [String]
        },
        
        linkTracking: {
            enabled: {
                type: Boolean,
                default: false
            },
            domain: String
        },
        
        abTesting: {
            enabled: {
                type: Boolean,
                default: false
            },
            variants: [{
                name: String,
                message: String,
                percentage: Number,
                sent: Number,
                delivered: Number
            }]
        }
    },

    // ═══ METADATA ═══
    metadata: {
        tags: [String],
        
        category: {
            type: String,
            enum: ['marketing', 'transactional', 'notification', 'reminder', 'survey', 'other'],
            default: 'marketing'
        },
        
        source: {
            type: String,
            enum: ['web', 'api', 'mobile', 'integration'],
            default: 'web'
        },
        
        customFields: mongoose.Schema.Types.Mixed
    },

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
campaignSchema.index({ user: 1, status: 1 });
campaignSchema.index({ 'schedule.startDate': 1 });
campaignSchema.index({ createdAt: -1 });
campaignSchema.index({ 'metadata.tags': 1 });

// ═══════════════════════════════════════════════════════════════
// VIRTUAL PROPERTIES
// ═══════════════════════════════════════════════════════════════

// Success rate percentage
campaignSchema.virtual('successRate').get(function() {
    if (this.stats.total === 0) return 0;
    return ((this.stats.delivered / this.stats.total) * 100).toFixed(2);
});

// Completion percentage
campaignSchema.virtual('completionPercentage').get(function() {
    if (this.stats.total === 0) return 0;
    const processed = this.stats.sent + this.stats.failed;
    return ((processed / this.stats.total) * 100).toFixed(2);
});

// Is active
campaignSchema.virtual('isActive').get(function() {
    return ['running', 'scheduled'].includes(this.status);
});

// Duration in minutes
campaignSchema.virtual('durationMinutes').get(function() {
    if (!this.execution.startedAt || !this.execution.completedAt) return null;
    return Math.round((this.execution.completedAt - this.execution.startedAt) / 60000);
});

// ═══════════════════════════════════════════════════════════════
// PRE-SAVE MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

campaignSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    
    // Calculate rates
    if (this.stats.total > 0) {
        this.stats.deliveryRate = ((this.stats.delivered / this.stats.total) * 100).toFixed(2);
        this.stats.readRate = ((this.stats.read / this.stats.total) * 100).toFixed(2);
        this.stats.failureRate = ((this.stats.failed / this.stats.total) * 100).toFixed(2);
    }
    
    this.stats.lastUpdated = Date.now();
    next();
});

// ═══════════════════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════════════════

// Start campaign
campaignSchema.methods.start = async function() {
    this.status = 'running';
    this.execution.startedAt = Date.now();
    return await this.save();
};

// Pause campaign
campaignSchema.methods.pause = async function() {
    this.status = 'paused';
    this.execution.pausedAt = Date.now();
    return await this.save();
};

// Resume campaign
campaignSchema.methods.resume = async function() {
    this.status = 'running';
    this.execution.pausedAt = null;
    return await this.save();
};

// Complete campaign
campaignSchema.methods.complete = async function() {
    this.status = 'completed';
    this.execution.completedAt = Date.now();
    return await this.save();
};

// Cancel campaign
campaignSchema.methods.cancel = async function(reason) {
    this.status = 'cancelled';
    this.execution.cancelledAt = Date.now();
    if (reason) {
        this.execution.errors.push({
            timestamp: Date.now(),
            error: reason
        });
    }
    return await this.save();
};

// Update stats
campaignSchema.methods.updateStats = async function(updates) {
    Object.assign(this.stats, updates);
    return await this.save();
};

// Increment sent
campaignSchema.methods.incrementSent = async function() {
    this.stats.sent += 1;
    this.execution.processedContacts += 1;
    return await this.save();
};

// Increment delivered
campaignSchema.methods.incrementDelivered = async function() {
    this.stats.delivered += 1;
    return await this.save();
};

// Increment failed
campaignSchema.methods.incrementFailed = async function(contactId, phoneNumber, error) {
    this.stats.failed += 1;
    this.execution.errors.push({
        timestamp: Date.now(),
        contactId,
        phoneNumber,
        error: error.message,
        errorCode: error.code
    });
    return await this.save();
};

// Get progress
campaignSchema.methods.getProgress = function() {
    return {
        total: this.stats.total,
        processed: this.execution.processedContacts,
        sent: this.stats.sent,
        delivered: this.stats.delivered,
        failed: this.stats.failed,
        pending: this.stats.pending,
        percentage: this.completionPercentage,
        estimatedCompletion: this.execution.estimatedCompletionTime
    };
};

// ═══════════════════════════════════════════════════════════════
// STATIC METHODS
// ═══════════════════════════════════════════════════════════════

// Find user campaigns
campaignSchema.statics.findByUser = function(userId, status) {
    const query = { user: userId };
    if (status) query.status = status;
    return this.find(query).sort({ createdAt: -1 });
};

// Find active campaigns
campaignSchema.statics.findActive = function() {
    return this.find({ status: { $in: ['running', 'scheduled'] } });
};

// Get campaign stats
campaignSchema.statics.getStats = async function(userId) {
    return await this.aggregate([
        { $match: userId ? { user: mongoose.Types.ObjectId(userId) } : {} },
        {
            $group: {
                _id: null,
                totalCampaigns: { $sum: 1 },
                totalMessages: { $sum: '$stats.sent' },
                totalDelivered: { $sum: '$stats.delivered' },
                totalFailed: { $sum: '$stats.failed' },
                avgDeliveryRate: { $avg: '$stats.deliveryRate' }
            }
        }
    ]);
};

module.exports = mongoose.model('Campaign', campaignSchema);
