const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const whatsappClient = require('./whatsapp');
const bulkSender = require('./bulk-sender');
const db = require('./database');
const config = require('./config');

// Configure file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /csv|xlsx|xls|jpg|jpeg|png|gif|pdf|mp4|avi/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only CSV, Excel, Images, Videos, and PDFs allowed.'));
        }
    }
});

// ==================== WHATSAPP CONNECTION ROUTES ====================

// Get WhatsApp status
router.get('/api/whatsapp/status', (req, res) => {
    try {
        const status = whatsappClient.getStatus();
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

// Initialize WhatsApp with QR Code
router.post('/api/whatsapp/connect/qr', async (req, res) => {
    try {
        if (whatsappClient.isReady) {
            return res.json({
                success: false,
                message: 'WhatsApp already connected'
            });
        }

        // Initialize with QR code
        await whatsappClient.initialize(false);

        res.json({
            success: true,
            message: 'WhatsApp initialization started. Please scan QR code.'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Initialize WhatsApp with Pairing Code
router.post('/api/whatsapp/connect/pairing', async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }

        if (whatsappClient.isReady) {
            return res.json({
                success: false,
                message: 'WhatsApp already connected'
            });
        }

        // Initialize with pairing code
        await whatsappClient.initialize(true, phoneNumber);

        res.json({
            success: true,
            message: 'Pairing code will be generated. Please enter it in WhatsApp.'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Logout from WhatsApp
router.post('/api/whatsapp/logout', async (req, res) => {
    try {
        await whatsappClient.logout();
        
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get QR Code
router.get('/api/whatsapp/qr', (req, res) => {
    try {
        const status = whatsappClient.getStatus();
        
        if (status.qrCode) {
            res.json({
                success: true,
                qrCode: status.qrCode
            });
        } else {
            res.json({
                success: false,
                message: 'QR code not available'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get Pairing Code
router.get('/api/whatsapp/pairing-code', (req, res) => {
    try {
        const status = whatsappClient.getStatus();
        
        if (status.pairingCode) {
            res.json({
                success: true,
                pairingCode: status.pairingCode
            });
        } else {
            res.json({
                success: false,
                message: 'Pairing code not available'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== CAMPAIGN ROUTES ====================

// Create new campaign
router.post('/api/campaign/create', upload.fields([
    { name: 'csv', maxCount: 1 },
    { name: 'media', maxCount: 1 }
]), async (req, res) => {
    try {
        const { name, message, delay, phoneNumbers } = req.body;
        
        let numbers = [];
        
        // Parse phone numbers from CSV file
        if (req.files && req.files.csv) {
            const csvPath = req.files.csv[0].path;
            numbers = await bulkSender.parseCSVFile(csvPath);
        }
        // Or use manually entered numbers
        else if (phoneNumbers) {
            numbers = phoneNumbers.split(/[
,;]+/).map(n => n.trim()).filter(n => n);
        }
        
        if (numbers.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No phone numbers provided'
            });
        }

        // Get media path if uploaded
        const mediaPath = req.files && req.files.media ? req.files.media[0].path : null;

        // Create campaign
        const result = await bulkSender.createCampaign(
            name || `Campaign ${Date.now()}`,
            message,
            numbers,
            mediaPath,
            parseInt(delay) || 3000
        );

        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start campaign
router.post('/api/campaign/:id/start', async (req, res) => {
    try {
        const campaignId = req.params.id;
        await bulkSender.startCampaign(campaignId);
        
        res.json({
            success: true,
            message: 'Campaign started successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Pause campaign
router.post('/api/campaign/:id/pause', async (req, res) => {
    try {
        const campaignId = req.params.id;
        await bulkSender.pauseCampaign(campaignId);
        
        res.json({
            success: true,
            message: 'Campaign paused successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Resume campaign
router.post('/api/campaign/:id/resume', async (req, res) => {
    try {
        const campaignId = req.params.id;
        await bulkSender.resumeCampaign(campaignId);
        
        res.json({
            success: true,
            message: 'Campaign resumed successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Stop campaign
router.post('/api/campaign/:id/stop', async (req, res) => {
    try {
        const campaignId = req.params.id;
        await bulkSender.stopCampaign(campaignId);
        
        res.json({
            success: true,
            message: 'Campaign stopped successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get campaign status
router.get('/api/campaign/:id/status', (req, res) => {
    try {
        const campaignId = req.params.id;
        const status = bulkSender.getCampaignStatus(campaignId);
        
        if (status) {
            res.json({
                success: true,
                data: status
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Campaign not found'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get all campaigns
router.get('/api/campaigns', async (req, res) => {
    try {
        const campaigns = await bulkSender.getAllCampaigns();
        
        res.json({
            success: true,
            data: campaigns
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== MESSAGE ROUTES ====================

// Send single message
router.post('/api/message/send', upload.single('media'), async (req, res) => {
    try {
        const { phoneNumber, message, delay } = req.body;
        
        if (!phoneNumber || !message) {
            return res.status(400).json({
                success: false,
                error: 'Phone number and message are required'
            });
        }

        const mediaPath = req.file ? req.file.path : null;

        const result = await whatsappClient.sendMessage(
            phoneNumber,
            message,
            mediaPath,
            parseInt(delay) || 2000
        );

        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Check if number exists on WhatsApp
router.post('/api/message/check-number', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }

        const exists = await whatsappClient.checkNumberExists(phoneNumber);

        res.json({
            success: true,
            exists: exists,
            phoneNumber: phoneNumber
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== STATISTICS ROUTES ====================

// Get daily stats
router.get('/api/stats/daily', (req, res) => {
    try {
        const stats = bulkSender.getDailyStats();
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get message logs
router.get('/api/stats/messages', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        
        const messages = await db.all(`
            SELECT * FROM message_logs 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `, [parseInt(limit), parseInt(offset)]);

        const total = await db.get(`SELECT COUNT(*) as count FROM message_logs`);

        res.json({
            success: true,
            data: messages,
            total: total.count
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get system logs
router.get('/api/stats/system-logs', async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        
        const logs = await db.all(`
            SELECT * FROM system_logs 
            ORDER BY created_at DESC 
            LIMIT ?
        `, [parseInt(limit)]);

        res.json({
            success: true,
            data: logs
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== ADMIN ROUTES ====================

// Get dashboard stats
router.get('/api/admin/dashboard', async (req, res) => {
    try {
        const totalCampaigns = await db.get(`SELECT COUNT(*) as count FROM campaigns`);
        const activeCampaigns = await db.get(`SELECT COUNT(*) as count FROM campaigns WHERE status = 'running'`);
        const totalMessages = await db.get(`SELECT COUNT(*) as count FROM message_logs WHERE direction = 'outgoing'`);
        const successMessages = await db.get(`SELECT COUNT(*) as count FROM message_logs WHERE direction = 'outgoing' AND status = 'sent'`);
        const failedMessages = await db.get(`SELECT COUNT(*) as count FROM message_logs WHERE direction = 'outgoing' AND status = 'failed'`);
        
        const dailyStats = bulkSender.getDailyStats();
        const whatsappStatus = whatsappClient.getStatus();

        res.json({
            success: true,
            data: {
                totalCampaigns: totalCampaigns.count,
                activeCampaigns: activeCampaigns.count,
                totalMessages: totalMessages.count,
                successMessages: successMessages.count,
                failedMessages: failedMessages.count,
                successRate: totalMessages.count > 0 
                    ? Math.round((successMessages.count / totalMessages.count) * 100) 
                    : 0,
                dailyStats: dailyStats,
                whatsappStatus: whatsappStatus
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
