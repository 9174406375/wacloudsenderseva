const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');

// @route   POST /api/campaigns
// @desc    Create new campaign
// @access  Private
router.post('/', protect, async (req, res) => {
    try {
        // Check user permissions
        if (!req.user.canPerformAction('canCreateCampaigns')) {
            return res.status(403).json({ 
                success: false, 
                error: 'You do not have permission to create campaigns' 
            });
        }

        const campaignData = {
            ...req.body,
            userId: req.user.id
        };

        const campaign = await Campaign.create(campaignData);

        // Update user stats
        req.user.stats.totalCampaigns++;
        await req.user.save();

        res.status(201).json({
            success: true,
            message: 'Campaign created successfully',
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

// @route   GET /api/campaigns
// @desc    Get all campaigns
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        
        const query = { userId: req.user.id };
        if (status) query.status = status;

        const campaigns = await Campaign.find(query)
            .sort('-createdAt')
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Campaign.countDocuments(query);

        res.json({
            success: true,
            data: campaigns,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   GET /api/campaigns/:id
// @desc    Get single campaign
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const campaign = await Campaign.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!campaign) {
            return res.status(404).json({ 
                success: false, 
                error: 'Campaign not found' 
            });
        }

        res.json({
            success: true,
            data: campaign
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   PUT /api/campaigns/:id
// @desc    Update campaign
// @access  Private
router.put('/:id', protect, async (req, res) => {
    try {
        let campaign = await Campaign.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!campaign) {
            return res.status(404).json({ 
                success: false, 
                error: 'Campaign not found' 
            });
        }

        // Don't allow updating running campaigns
        if (campaign.status === 'running') {
            return res.status(400).json({ 
                success: false, 
                error: 'Cannot update running campaign' 
            });
        }

        campaign = await Campaign.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.json({
            success: true,
            data: campaign
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   DELETE /api/campaigns/:id
// @desc    Delete campaign
// @access  Private
router.delete('/:id', protect, async (req, res) => {
    try {
        const campaign = await Campaign.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!campaign) {
            return res.status(404).json({ 
                success: false, 
                error: 'Campaign not found' 
            });
        }

        res.json({
            success: true,
            message: 'Campaign deleted successfully'
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   POST /api/campaigns/:id/start
// @desc    Start campaign manually
// @access  Private
router.post('/:id/start', protect, async (req, res) => {
    try {
        const campaign = await Campaign.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!campaign) {
            return res.status(404).json({ 
                success: false, 
                error: 'Campaign not found' 
            });
        }

        campaign.status = 'running';
        campaign.startedAt = new Date();
        await campaign.save();

        res.json({
            success: true,
            message: 'Campaign started',
            data: campaign
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
