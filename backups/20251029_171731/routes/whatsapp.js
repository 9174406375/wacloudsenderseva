const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const whatsappService = require('../services/whatsappService');
const QRCode = require('qrcode');

// @route   POST /api/whatsapp/connect
// @desc    Connect WhatsApp (QR or Pairing Code)
// @access  Private
router.post('/connect', protect, async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        const result = await whatsappService.connect(
            req.user.id.toString(),
            phoneNumber
        );

        if (result.type === 'qr_code' && result.qr) {
            // Generate QR code as base64 image
            const qrImage = await QRCode.toDataURL(result.qr);
            
            res.json({
                success: true,
                type: 'qr_code',
                qrCode: qrImage,
                message: 'Scan QR code with WhatsApp'
            });
        } else if (result.type === 'pairing_code') {
            res.json({
                success: true,
                type: 'pairing_code',
                code: result.code,
                message: 'Enter pairing code in WhatsApp'
            });
        } else {
            res.json({
                success: true,
                message: 'Connecting...'
            });
        }

    } catch (error) {
        console.error('WhatsApp connect error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   GET /api/whatsapp/status
// @desc    Get WhatsApp connection status
// @access  Private
router.get('/status', protect, async (req, res) => {
    try {
        const status = whatsappService.getStatus();
        
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

// @route   POST /api/whatsapp/disconnect
// @desc    Disconnect WhatsApp
// @access  Private
router.post('/disconnect', protect, async (req, res) => {
    try {
        await whatsappService.disconnect();
        
        // Update user
        req.user.whatsapp.connected = false;
        req.user.whatsapp.sessionData = null;
        await req.user.save();

        res.json({
            success: true,
            message: 'WhatsApp disconnected successfully'
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   POST /api/whatsapp/send
// @desc    Send single message
// @access  Private
router.post('/send', protect, async (req, res) => {
    try {
        const { to, message, mediaUrl, mediaType } = req.body;

        const result = await whatsappService.sendMessage(to, message, {
            mediaUrl,
            mediaType
        });

        if (result.success) {
            req.user.stats.totalMessagesSent++;
            await req.user.save();
        }

        res.json({
            success: result.success,
            data: result
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
