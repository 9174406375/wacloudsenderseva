/**
 * ═══════════════════════════════════════════════════════════════
 * WHATSAPP ROUTES - Complete WhatsApp Integration
 * ═══════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const whatsappService = require('../services/whatsappService');

router.use(protect);

/**
 * POST /api/whatsapp/connect - Initialize WhatsApp connection
 */
router.post('/connect', async (req, res) => {
    try {
        const userId = req.user._id;
        const sessionId = req.body.sessionId || 'default';
        const io = req.app.get('io');

        const result = await whatsappService.initializeClient(userId, sessionId, {
            io,
            User: require('../models/User')
        });

        res.json(result);

    } catch (error) {
        console.error('WhatsApp connect error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/whatsapp/status - Get connection status
 */
router.get('/status', async (req, res) => {
    try {
        const userId = req.user._id;
        const sessionId = req.query.sessionId || 'default';

        const status = whatsappService.getClientStatus(userId, sessionId);

        res.json({
            success: true,
            data: status
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/whatsapp/disconnect - Disconnect WhatsApp
 */
router.post('/disconnect', async (req, res) => {
    try {
        const userId = req.user._id;
        const sessionId = req.body.sessionId || 'default';

        const result = await whatsappService.disconnectClient(userId, sessionId);

        res.json(result);

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/whatsapp/send - Send single message
 */
router.post('/send', async (req, res) => {
    try {
        const { phoneNumber, message, sessionId } = req.body;
        const userId = req.user._id;

        const result = await whatsappService.sendMessage(
            userId,
            sessionId || 'default',
            phoneNumber,
            message
        );

        res.json(result);

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
