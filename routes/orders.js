const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Order = require('../models/Order');
const whatsappService = require('../services/whatsappService');

// Get all orders
router.get('/', protect, async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50);
        
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

// Get single order
router.get('/:id', protect, async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            user: req.user._id
        });
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        res.json({
            success: true,
            data: order
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Create new order
router.post('/', protect, async (req, res) => {
    try {
        const {
            customerName,
            customerPhone,
            customerEmail,
            items,
            totalAmount,
            address,
            paymentMethod,
            notes
        } = req.body;
        
        // Validation
        if (!customerName || !customerPhone || !items || items.length === 0 || !totalAmount) {
            return res.status(400).json({
                success: false,
                message: 'Customer name, phone, items, and total amount are required'
            });
        }
        
        // Create order
        const order = new Order({
            customerName,
            customerPhone,
            customerEmail,
            items,
            totalAmount,
            address,
            paymentMethod: paymentMethod || 'cod',
            notes,
            user: req.user._id,
            orderStatus: 'pending',
            paymentStatus: 'pending'
        });
        
        await order.save();
        
        // Send WhatsApp notification to admin
        const adminMessage = `🔔 *New Book Order!*

` +
            `📋 Order #: ${order.orderNumber}
` +
            `👤 Customer: ${customerName}
` +
            `📱 Phone: ${customerPhone}
` +
            `💰 Amount: ₹${totalAmount}
` +
            `📚 Items: ${items.length}
` +
            `📍 City: ${address?.city || 'N/A'}
` +
            `💳 Payment: ${paymentMethod || 'COD'}

` +
            `View details: ${process.env.CLIENT_URL}/orders/${order._id}`;
        
        // Send to admin (placeholder - works on Railway)
        await whatsappService.sendMessage(
            req.user._id.toString(),
            process.env.ADMIN_NUMBER,
            adminMessage
        );
        
        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            data: order
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Update order status
router.put('/:id/status', protect, async (req, res) => {
    try {
        const { orderStatus, paymentStatus, trackingNumber } = req.body;
        
        const order = await Order.findOne({
            _id: req.params.id,
            user: req.user._id
        });
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        // Update fields
        if (orderStatus) order.orderStatus = orderStatus;
        if (paymentStatus) order.paymentStatus = paymentStatus;
        if (trackingNumber) order.trackingNumber = trackingNumber;
        
        await order.save();
        
        // Send WhatsApp update to customer
        const statusMessage = `📦 *Order Update*

` +
            `Order #: ${order.orderNumber}
` +
            `Status: ${orderStatus || order.orderStatus}
` +
            `${trackingNumber ? `Tracking: ${trackingNumber}
` : ''}` +
            `
Thank you for your order!`;
        
        await whatsappService.sendMessage(
            req.user._id.toString(),
            order.customerPhone,
            statusMessage
        );
        
        res.json({
            success: true,
            message: 'Order updated successfully',
            data: order
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Delete order
router.delete('/:id', protect, async (req, res) => {
    try {
        const order = await Order.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id
        });
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Order deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get order statistics
router.get('/stats/summary', protect, async (req, res) => {
    try {
        const totalOrders = await Order.countDocuments({ user: req.user._id });
        const pendingOrders = await Order.countDocuments({ 
            user: req.user._id, 
            orderStatus: 'pending' 
        });
        const deliveredOrders = await Order.countDocuments({ 
            user: req.user._id, 
            orderStatus: 'delivered' 
        });
        
        const totalRevenue = await Order.aggregate([
            { $match: { user: req.user._id, paymentStatus: 'paid' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        
        res.json({
            success: true,
            stats: {
                totalOrders,
                pendingOrders,
                deliveredOrders,
                totalRevenue: totalRevenue[0]?.total || 0
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
