const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Order = require('../models/Order');
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const moment = require('moment-timezone');

// @route   GET /api/analytics/overview
// @desc    Get overview analytics
// @access  Private
router.get('/overview', protect, async (req, res) => {
    try {
        const userId = req.user.id;

        const [orders, campaigns, contacts] = await Promise.all([
            Order.countDocuments({ userId }),
            Campaign.countDocuments({ userId }),
            Contact.countDocuments({ userId })
        ]);

        const totalMessagesSent = await Campaign.aggregate([
            { $match: { userId: req.user._id } },
            { $group: { _id: null, total: { $sum: '$stats.sentCount' } } }
        ]);

        res.json({
            success: true,
            data: {
                orders,
                campaigns,
                contacts,
                messagesSent: totalMessagesSent[0]?.total || 0
            }
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   GET /api/analytics/orders
// @desc    Get order analytics
// @access  Private
router.get('/orders', protect, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const userId = req.user.id;

        const dateFilter = {};
        if (startDate && endDate) {
            dateFilter.orderedAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const ordersByStatus = await Order.aggregate([
            { $match: { userId: req.user._id, ...dateFilter } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const ordersByPincode = await Order.aggregate([
            { $match: { userId: req.user._id, ...dateFilter } },
            { $group: { _id: '$deliveryAddress.pincode', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        const ordersByCity = await Order.aggregate([
            { $match: { userId: req.user._id, ...dateFilter } },
            { $group: { _id: '$deliveryAddress.city', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        res.json({
            success: true,
            data: {
                byStatus: ordersByStatus,
                byPincode: ordersByPincode,
                byCity: ordersByCity
            }
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   GET /api/analytics/campaigns
// @desc    Get campaign analytics
// @access  Private
router.get('/campaigns', protect, async (req, res) => {
    try {
        const campaignStats = await Campaign.aggregate([
            { $match: { userId: req.user._id } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalSent: { $sum: '$stats.sentCount' },
                    totalFailed: { $sum: '$stats.failedCount' }
                }
            }
        ]);

        const successRate = await Campaign.aggregate([
            { $match: { userId: req.user._id, status: 'completed' } },
            {
                $group: {
                    _id: null,
                    avgSuccessRate: { $avg: '$stats.successRate' }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                campaignStats,
                avgSuccessRate: successRate[0]?.avgSuccessRate || 0
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
