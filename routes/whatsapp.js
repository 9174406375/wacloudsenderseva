const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const whatsappService = require('../services/whatsappService');

// Status endpoint
router.get('/status', protect, async (req, res) => {
    res.json({
        success: true,
        status: 'disabled_termux',
        message: 'WhatsApp will be enabled on Railway deployment',
        environment: process.env.NODE_ENV || 'development'
    });
});

// Connect endpoint (placeholder)
router.post('/connect', protect, async (req, res) => {
    const result = await whatsappService.initializeClient(req.user._id.toString());
    res.json(result);
});

// Send message (placeholder)
router.post('/send', protect, async (req, res) => {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
        return res.status(400).json({
            success: false,
            message: 'Phone number and message required'
        });
    }

    const result = await whatsappService.sendMessage(
        req.user._id.toString(),
        phoneNumber,
        message
    );

    res.json(result);
});

// Bulk send (placeholder)
router.post('/bulk', protect, async (req, res) => {
    const { recipients, message } = req.body;
    
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Recipients array required'
        });
    }

    if (!message) {
        return res.status(400).json({
            success: false,
            message: 'Message required'
        });
    }

    const result = await whatsappService.sendBulkMessages(
        req.user._id.toString(),
        recipients,
        message
    );

    res.json(result);
});

// Disconnect endpoint
router.post('/disconnect', protect, async (req, res) => {
    const result = await whatsappService.disconnectClient(req.user._id.toString());
    res.json(result);
});

module.exports = router;
