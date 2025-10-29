const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Contact = require('../models/Contact');
const Order = require('../models/Order');
const Campaign = require('../models/Campaign');

// Admin middleware - check if user is admin
const isAdmin = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        // Check if user email or phone matches admin
        const isAdminUser = req.user.email === process.env.ADMIN_EMAIL || 
                           req.user.phone === process.env.ADMIN_NUMBER ||
                           req.user.isAdmin === true;

        if (!isAdminUser) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin only.'
            });
        }

        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Admin dashboard - Overview stats
router.get('/dashboard', protect, isAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalContacts = await Contact.countDocuments();
        const totalOrders = await Order.countDocuments();
        const totalCampaigns = await Campaign.countDocuments();

        // Revenue
        const revenueData = await Order.aggregate([
            { $match: { paymentStatus: 'paid' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);

        // Recent orders (last 10)
        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .select('orderNumber customerName totalAmount orderStatus createdAt');

        // Message stats
        const sentMessages = await Contact.countDocuments({ status: 'sent' });
        const failedMessages = await Contact.countDocuments({ status: 'failed' });

        res.json({
            success: true,
            stats: {
                users: totalUsers,
                contacts: totalContacts,
                orders: totalOrders,
                campaigns: totalCampaigns,
                revenue: revenueData[0]?.total || 0,
                messages: {
                    sent: sentMessages,
                    failed: failedMessages
                }
            },
            recentOrders
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get all users
router.get('/users', protect, isAdmin, async (req, res) => {
    try {
        const users = await User.find()
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(100);

        res.json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get user details
router.get('/users/:id', protect, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user's stats
        const userOrders = await Order.countDocuments({ user: req.params.id });
        const userContacts = await Contact.countDocuments({ user: req.params.id });
        const userCampaigns = await Campaign.countDocuments({ user: req.params.id });

        res.json({
            success: true,
            data: {
                user,
                stats: {
                    orders: userOrders,
                    contacts: userContacts,
                    campaigns: userCampaigns
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Update user (make admin, suspend, etc.)
router.put('/users/:id', protect, isAdmin, async (req, res) => {
    try {
        const { isAdmin: makeAdmin, isActive } = req.body;

        const updateData = {};
        if (typeof makeAdmin !== 'undefined') updateData.isAdmin = makeAdmin;
        if (typeof isActive !== 'undefined') updateData.isActive = isActive;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'User updated successfully',
            data: user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Delete user
router.delete('/users/:id', protect, isAdmin, async (req, res) => {
    try {
        // Prevent deleting own account
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own account'
            });
        }

        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Optionally delete user's data
        await Contact.deleteMany({ user: req.params.id });
        await Campaign.deleteMany({ user: req.params.id });
        await Order.deleteMany({ user: req.params.id });

        res.json({
            success: true,
            message: 'User and associated data deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get all orders (admin view)
router.get('/orders', protect, isAdmin, async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 })
            .limit(100);

        res.json({
            success: true,
            count: orders.length,
            data: orders
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get all campaigns (admin view)
router.get('/campaigns', protect, isAdmin, async (req, res) => {
    try {
        const campaigns = await Campaign.find()
            .populate('user', 'name email')
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({
            success: true,
            count: campaigns.length,
            data: campaigns
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// System settings
router.get('/settings', protect, isAdmin, async (req, res) => {
    try {
        res.json({
            success: true,
            settings: {
                adminEmail: process.env.ADMIN_EMAIL,
                adminNumber: process.env.ADMIN_NUMBER,
                businessName: process.env.BUSINESS_NAME,
                maxMessagesPerDay: process.env.MAX_MESSAGES_PER_DAY,
                features: {
                    bookOrders: process.env.ENABLE_BOOK_ORDERS === 'true',
                    bulkSender: process.env.ENABLE_BULK_SENDER === 'true',
                    autoRetry: process.env.ENABLE_AUTO_RETRY === 'true'
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
