const express = require('express');
const router = express.Router();
const Campaign = require('../models/Campaign');
const { protect } = require('../middleware/auth');

// Create campaign
router.post('/', protect, async (req, res) => {
    try {
        const { name, message, contacts, scheduleType, scheduledAt, delayBetweenMessages } = req.body;
        
        const campaign = await Campaign.create({
            userId: req.user._id,
            name,
            message,
            contacts: contacts.map(c => ({ phone: c.phone, name: c.name })),
            scheduleType,
            scheduledAt: scheduleType === 'scheduled' ? scheduledAt : null,
            totalContacts: contacts.length,
            delayBetweenMessages: delayBetweenMessages || 3000
        });
        
        res.status(201).json({ success: true, data: campaign });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all campaigns
router.get('/', protect, async (req, res) => {
    try {
        const campaigns = await Campaign.find({ userId: req.user._id })
            .sort('-createdAt');
        res.json({ success: true, data: campaigns });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single campaign
router.get('/:id', protect, async (req, res) => {
    try {
        const campaign = await Campaign.findOne({
            _id: req.params.id,
            userId: req.user._id
        });
        
        if (!campaign) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }
        
        res.json({ success: true, data: campaign });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete campaign
router.delete('/:id', protect, async (req, res) => {
    try {
        const campaign = await Campaign.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });
        
        if (!campaign) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }
        
        res.json({ success: true, message: 'Campaign deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
