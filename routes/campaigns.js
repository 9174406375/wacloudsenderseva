/**
 * ═══════════════════════════════════════════════════════════════
 * CAMPAIGN ROUTES - Fixed & Enhanced
 * ═══════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const ContactList = require('../models/ContactList');
const { protect } = require('../middleware/auth');
const messageService = require('../services/messageService');

// Apply auth to all routes
router.use(protect);

/**
 * GET /api/campaigns/stats - Get user statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const userId = req.user._id;

        // Get campaigns stats
        const campaigns = await Campaign.find({ user: userId });
        
        const stats = {
            totalCampaigns: campaigns.length,
            activeCampaigns: campaigns.filter(c => c.status === 'running').length,
            totalSent: campaigns.reduce((sum, c) => sum + (c.stats.sent || 0), 0),
            totalFailed: campaigns.reduce((sum, c) => sum + (c.stats.failed || 0), 0),
            totalContacts: await Contact.countDocuments({ user: userId }),
            successRate: 0
        };

        if (stats.totalSent > 0) {
            stats.successRate = Math.round((stats.totalSent / (stats.totalSent + stats.totalFailed)) * 100);
        }

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load stats'
        });
    }
});

/**
 * GET /api/campaigns - Get all user campaigns
 */
router.get('/', async (req, res) => {
    try {
        const campaigns = await Campaign.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({
            success: true,
            data: campaigns
        });

    } catch (error) {
        console.error('Get campaigns error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load campaigns'
        });
    }
});

/**
 * POST /api/campaigns - Create new campaign
 */
router.post('/', async (req, res) => {
    try {
        const { name, message, contactList, scheduledFor, deliverySettings } = req.body;

        const campaign = await Campaign.create({
            user: req.user._id,
            name,
            message,
            contactList,
            scheduledFor,
            deliverySettings: deliverySettings || {
                minDelay: 3000,
                maxDelay: 10000,
                batchSize: 20,
                cooldownPeriod: 60000,
                dailyPercentage: 100
            },
            status: scheduledFor ? 'scheduled' : 'draft'
        });

        res.status(201).json({
            success: true,
            data: campaign
        });

    } catch (error) {
        console.error('Create campaign error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/campaigns/:id/start - Start campaign
 */
router.post('/:id/start', async (req, res) => {
    try {
        const io = req.app.get('io');
        
        const result = await messageService.startCampaign(
            req.params.id,
            req.user._id,
            { io }
        );

        res.json(result);

    } catch (error) {
        console.error('Start campaign error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/campaigns/:id/pause - Pause campaign
 */
router.post('/:id/pause', async (req, res) => {
    try {
        const result = await messageService.pauseCampaign(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/campaigns/:id/resume - Resume campaign
 */
router.post('/:id/resume', async (req, res) => {
    try {
        const io = req.app.get('io');
        const result = await messageService.resumeCampaign(req.params.id, req.user._id, { io });
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/campaigns/:id/retry - Retry failed messages
 */
router.post('/:id/retry', async (req, res) => {
    try {
        const io = req.app.get('io');
        const result = await messageService.retryFailedMessages(req.params.id, req.user._id, { io });
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
