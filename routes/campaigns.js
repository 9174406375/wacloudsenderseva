/**
 * ═══════════════════════════════════════════════════════════════
 * CAMPAIGN ROUTES - Complete CRUD + Advanced Features
 * WhatsApp Bulk Messaging Campaign Management
 * ═══════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const ContactList = require('../models/ContactList');
const { protect, checkPermission } = require('../middleware/auth');

// ═══════════════════════════════════════════════════════════════
// GET ALL CAMPAIGNS (with pagination, filtering, sorting)
// ═══════════════════════════════════════════════════════════════
router.get('/', protect, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            category,
            sortBy = 'createdAt',
            order = 'desc',
            search
        } = req.query;

        // Build query
        const query = { user: req.userId };
        
        if (status) query.status = status;
        if (category) query['metadata.category'] = category;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Execute query with pagination
        const campaigns = await Campaign.find(query)
            .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .select('-execution.errors')
            .lean();

        const total = await Campaign.countDocuments(query);

        // Calculate summary stats
        const summary = await Campaign.aggregate([
            { $match: { user: req.userId } },
            {
                $group: {
                    _id: null,
                    totalCampaigns: { $sum: 1 },
                    totalMessagesSent: { $sum: '$stats.sent' },
                    totalDelivered: { $sum: '$stats.delivered' },
                    activeCampaigns: {
                        $sum: { $cond: [{ $in: ['$status', ['running', 'scheduled']] }, 1, 0] }
                    }
                }
            }
        ]);

        res.json({
            success: true,
            data: campaigns,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            },
            summary: summary[0] || {
                totalCampaigns: 0,
                totalMessagesSent: 0,
                totalDelivered: 0,
                activeCampaigns: 0
            }
        });

    } catch (error) {
        console.error('Get campaigns error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch campaigns'
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// GET SINGLE CAMPAIGN BY ID (with full details)
// ═══════════════════════════════════════════════════════════════
router.get('/:id', protect, async (req, res) => {
    try {
        const campaign = await Campaign.findOne({
            _id: req.params.id,
            user: req.userId
        })
        .populate('targeting.contactLists', 'name totalContacts')
        .lean();

        if (!campaign) {
            return res.status(404).json({
                success: false,
                error: 'Campaign not found'
            });
        }

        // Get recent errors (last 10)
        campaign.recentErrors = campaign.execution.errors.slice(-10);
        delete campaign.execution.errors;

        res.json({
            success: true,
            data: campaign
        });

    } catch (error) {
        console.error('Get campaign error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch campaign'
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// CREATE NEW CAMPAIGN
// ═══════════════════════════════════════════════════════════════
router.post('/', protect, checkPermission('bulk_send'), async (req, res) => {
    try {
        const {
            name,
            description,
            message,
            targeting,
            schedule,
            delivery,
            metadata
        } = req.body;

        // Validation
        if (!name || !message?.text || !delivery?.whatsappSession) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, message.text, delivery.whatsappSession'
            });
        }

        // Calculate total contacts
        let totalContacts = 0;
        
        if (targeting?.contactLists?.length > 0) {
            const lists = await ContactList.find({
                _id: { $in: targeting.contactLists },
                user: req.userId
            });
            totalContacts += lists.reduce((sum, list) => sum + list.totalContacts, 0);
        }
        
        if (targeting?.contactIds?.length > 0) {
            totalContacts += targeting.contactIds.length;
        }

        if (totalContacts === 0) {
            return res.status(400).json({
                success: false,
                error: 'No contacts selected for campaign'
            });
        }

        // Check user's message quota
        const User = require('../models/User');
        const user = await User.findById(req.userId);
        const canSend = user.canSendMessage(totalContacts);
        
        if (!canSend.allowed) {
            return res.status(403).json({
                success: false,
                error: canSend.reason
            });
        }

        // Create campaign
        const campaign = new Campaign({
            user: req.userId,
            name,
            description,
            message,
            targeting: {
                ...targeting,
                totalContacts
            },
            schedule: schedule || { type: 'immediate' },
            delivery,
            metadata,
            stats: {
                total: totalContacts,
                pending: totalContacts
            }
        });

        await campaign.save();

        // Update user activity
        user.activity.campaignsCreated += 1;
        await user.save();

        res.status(201).json({
            success: true,
            message: 'Campaign created successfully',
            data: campaign
        });

    } catch (error) {
        console.error('Create campaign error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create campaign'
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// UPDATE CAMPAIGN (only drafts can be fully edited)
// ═══════════════════════════════════════════════════════════════
router.put('/:id', protect, async (req, res) => {
    try {
        const campaign = await Campaign.findOne({
            _id: req.params.id,
            user: req.userId
        });

        if (!campaign) {
            return res.status(404).json({
                success: false,
                error: 'Campaign not found'
            });
        }

        // Only drafts can be fully edited
        if (campaign.status !== 'draft') {
            return res.status(400).json({
                success: false,
                error: 'Only draft campaigns can be edited. Use action endpoints for running campaigns.'
            });
        }

        const allowedUpdates = [
            'name', 'description', 'message', 'targeting', 
            'schedule', 'delivery', 'metadata'
        ];

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                campaign[field] = req.body[field];
            }
        });

        // Recalculate total if targeting changed
        if (req.body.targeting) {
            let totalContacts = 0;
            
            if (campaign.targeting.contactLists?.length > 0) {
                const lists = await ContactList.find({
                    _id: { $in: campaign.targeting.contactLists },
                    user: req.userId
                });
                totalContacts += lists.reduce((sum, list) => sum + list.totalContacts, 0);
            }
            
            if (campaign.targeting.contactIds?.length > 0) {
                totalContacts += campaign.targeting.contactIds.length;
            }

            campaign.targeting.totalContacts = totalContacts;
            campaign.stats.total = totalContacts;
            campaign.stats.pending = totalContacts;
        }

        await campaign.save();

        res.json({
            success: true,
            message: 'Campaign updated successfully',
            data: campaign
        });

    } catch (error) {
        console.error('Update campaign error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update campaign'
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// DELETE CAMPAIGN (only drafts can be deleted)
// ═══════════════════════════════════════════════════════════════
router.delete('/:id', protect, async (req, res) => {
    try {
        const campaign = await Campaign.findOne({
            _id: req.params.id,
            user: req.userId
        });

        if (!campaign) {
            return res.status(404).json({
                success: false,
                error: 'Campaign not found'
            });
        }

        if (campaign.status !== 'draft') {
            return res.status(400).json({
                success: false,
                error: 'Only draft campaigns can be deleted'
            });
        }

        await campaign.remove();

        res.json({
            success: true,
            message: 'Campaign deleted successfully'
        });

    } catch (error) {
        console.error('Delete campaign error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete campaign'
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// START CAMPAIGN
// ═══════════════════════════════════════════════════════════════
router.post('/:id/start', protect, async (req, res) => {
    try {
        const campaign = await Campaign.findOne({
            _id: req.params.id,
            user: req.userId
        });

        if (!campaign) {
            return res.status(404).json({
                success: false,
                error: 'Campaign not found'
            });
        }

        if (!['draft', 'paused'].includes(campaign.status)) {
            return res.status(400).json({
                success: false,
                error: 'Campaign can only be started from draft or paused state'
            });
        }

        await campaign.start();

        // TODO: Trigger actual campaign execution in background
        // This would integrate with WhatsApp sender service

        res.json({
            success: true,
            message: 'Campaign started successfully',
            data: campaign
        });

    } catch (error) {
        console.error('Start campaign error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to start campaign'
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// PAUSE CAMPAIGN
// ═══════════════════════════════════════════════════════════════
router.post('/:id/pause', protect, async (req, res) => {
    try {
        const campaign = await Campaign.findOne({
            _id: req.params.id,
            user: req.userId
        });

        if (!campaign) {
            return res.status(404).json({
                success: false,
                error: 'Campaign not found'
            });
        }

        if (campaign.status !== 'running') {
            return res.status(400).json({
                success: false,
                error: 'Only running campaigns can be paused'
            });
        }

        await campaign.pause();

        res.json({
            success: true,
            message: 'Campaign paused successfully',
            data: campaign
        });

    } catch (error) {
        console.error('Pause campaign error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to pause campaign'
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// RESUME CAMPAIGN
// ═══════════════════════════════════════════════════════════════
router.post('/:id/resume', protect, async (req, res) => {
    try {
        const campaign = await Campaign.findOne({
            _id: req.params.id,
            user: req.userId
        });

        if (!campaign) {
            return res.status(404).json({
                success: false,
                error: 'Campaign not found'
            });
        }

        if (campaign.status !== 'paused') {
            return res.status(400).json({
                success: false,
                error: 'Only paused campaigns can be resumed'
            });
        }

        await campaign.resume();

        res.json({
            success: true,
            message: 'Campaign resumed successfully',
            data: campaign
        });

    } catch (error) {
        console.error('Resume campaign error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to resume campaign'
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// CANCEL CAMPAIGN
// ═══════════════════════════════════════════════════════════════
router.post('/:id/cancel', protect, async (req, res) => {
    try {
        const campaign = await Campaign.findOne({
            _id: req.params.id,
            user: req.userId
        });

        if (!campaign) {
            return res.status(404).json({
                success: false,
                error: 'Campaign not found'
            });
        }

        if (['completed', 'cancelled'].includes(campaign.status)) {
            return res.status(400).json({
                success: false,
                error: 'Campaign already completed or cancelled'
            });
        }

        await campaign.cancel(req.body.reason);

        res.json({
            success: true,
            message: 'Campaign cancelled successfully',
            data: campaign
        });

    } catch (error) {
        console.error('Cancel campaign error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cancel campaign'
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// GET CAMPAIGN STATISTICS
// ═══════════════════════════════════════════════════════════════
router.get('/:id/stats', protect, async (req, res) => {
    try {
        const campaign = await Campaign.findOne({
            _id: req.params.id,
            user: req.userId
        }).select('stats execution metadata createdAt');

        if (!campaign) {
            return res.status(404).json({
                success: false,
                error: 'Campaign not found'
            });
        }

        const progress = campaign.getProgress();

        res.json({
            success: true,
            data: {
                ...campaign.toObject(),
                progress
            }
        });

    } catch (error) {
        console.error('Get campaign stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch campaign statistics'
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// DUPLICATE CAMPAIGN
// ═══════════════════════════════════════════════════════════════
router.post('/:id/duplicate', protect, async (req, res) => {
    try {
        const original = await Campaign.findOne({
            _id: req.params.id,
            user: req.userId
        });

        if (!original) {
            return res.status(404).json({
                success: false,
                error: 'Campaign not found'
            });
        }

        const duplicate = new Campaign({
            ...original.toObject(),
            _id: undefined,
            name: `${original.name} (Copy)`,
            status: 'draft',
            stats: {
                total: original.targeting.totalContacts,
                pending: original.targeting.totalContacts,
                sent: 0,
                delivered: 0,
                read: 0,
                failed: 0
            },
            execution: {
                currentBatch: 0,
                totalBatches: 0,
                processedContacts: 0,
                errors: []
            },
            createdAt: Date.now(),
            updatedAt: Date.now()
        });

        await duplicate.save();

        res.status(201).json({
            success: true,
            message: 'Campaign duplicated successfully',
            data: duplicate
        });

    } catch (error) {
        console.error('Duplicate campaign error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to duplicate campaign'
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// GET CAMPAIGN ERRORS
// ═══════════════════════════════════════════════════════════════
router.get('/:id/errors', protect, async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;

        const campaign = await Campaign.findOne({
            _id: req.params.id,
            user: req.userId
        }).select('execution.errors');

        if (!campaign) {
            return res.status(404).json({
                success: false,
                error: 'Campaign not found'
            });
        }

        const errors = campaign.execution.errors;
        const total = errors.length;
        const start = (page - 1) * limit;
        const end = start + parseInt(limit);

        res.json({
            success: true,
            data: errors.slice(start, end),
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get campaign errors:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch campaign errors'
        });
    }
});

module.exports = router;
