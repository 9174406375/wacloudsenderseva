const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');

// @route   GET /api/admin/users
// @desc    Get all users (Admin only)
// @access  Private/Admin
router.get('/users', protect, admin, async (req, res) => {
    try {
        const users = await User.find()
            .select('-password')
            .sort('-createdAt');

        res.json({
            success: true,
            data: users
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   PUT /api/admin/users/:id/permissions
// @desc    Update user permissions
// @access  Private/Admin
router.put('/users/:id/permissions', protect, admin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }

        user.permissions = { ...user.permissions, ...req.body };
        await user.save();

        res.json({
            success: true,
            data: user
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard stats
// @access  Private/Admin
router.get('/dashboard', protect, admin, async (req, res) => {
    try {
        const [
            totalUsers,
            totalOrders,
            totalCampaigns,
            totalContacts,
            recentOrders,
            recentCampaigns
        ] = await Promise.all([
            User.countDocuments(),
            Order.countDocuments(),
            Campaign.countDocuments(),
            Contact.countDocuments(),
            Order.find().sort('-createdAt').limit(10).populate('userId', 'name email'),
            Campaign.find().sort('-createdAt').limit(10).populate('userId', 'name email')
        ]);

        const ordersByStatus = await Order.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const campaignsByStatus = await Campaign.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        res.json({
            success: true,
            data: {
                stats: {
                    totalUsers,
                    totalOrders,
                    totalCampaigns,
                    totalContacts
                },
                ordersByStatus,
                campaignsByStatus,
                recentOrders,
                recentCampaigns
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
