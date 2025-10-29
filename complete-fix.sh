#!/bin/bash

echo "🔧 Complete System Fix..."

# Install missing packages
npm install moment-timezone --save --ignore-scripts

# Delete & renew problematic files
rm -f routes/analytics.js

# Create analytics without moment-timezone
cat > routes/analytics.js << 'EOF'
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Contact = require('../models/Contact');
const Order = require('../models/Order');

router.get('/dashboard', protect, async (req, res) => {
    try {
        const totalContacts = await Contact.countDocuments({ user: req.user._id });
        const totalSent = await Contact.countDocuments({ user: req.user._id, status: 'sent' });
        const totalFailed = await Contact.countDocuments({ user: req.user._id, status: 'failed' });
        const successRate = totalContacts > 0 ? ((totalSent / totalContacts) * 100).toFixed(2) : 0;
        
        const totalOrders = await Order.countDocuments({ user: req.user._id });
        const revenueData = await Order.aggregate([
            { $match: { user: req.user._id, paymentStatus: 'paid' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        
        res.json({
            success: true,
            stats: {
                contacts: { total: totalContacts },
                messages: { sent: totalSent, failed: totalFailed, successRate: `${successRate}%` },
                orders: { total: totalOrders, revenue: revenueData[0]?.total || 0 }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
EOF

echo "✅ Files renewed!"

# Test server
timeout 5 node server.js 2>&1 | head -20

echo ""
echo "🚀 If no errors above, run: node server.js"
