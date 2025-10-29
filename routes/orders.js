const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Order = require('../models/Order');
const orderService = require('../services/orderService');

// @route   POST /api/orders
// @desc    Create new order
// @access  Private
router.post('/', protect, async (req, res) => {
    try {
        const orderData = {
            ...req.body,
            userId: req.user.id
        };

        const result = await orderService.createOrder(orderData);
        
        if (!result.success) {
            return res.status(400).json(result);
        }

        // Update user stats
        req.user.stats.totalOrders++;
        await req.user.save();

        res.status(201).json(result);

    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   GET /api/orders
// @desc    Get all orders for user
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const { status, pincode, startDate, endDate, page = 1, limit = 20 } = req.query;
        
        const query = { userId: req.user.id };
        
        if (status) query.status = status;
        if (pincode) query['deliveryAddress.pincode'] = pincode;
        if (startDate && endDate) {
            query.orderedAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const orders = await Order.find(query)
            .sort('-orderedAt')
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Order.countDocuments(query);

        res.json({
            success: true,
            data: orders,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   GET /api/orders/:id
// @desc    Get single order
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                error: 'Order not found' 
            });
        }

        res.json({
            success: true,
            data: order
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   PUT /api/orders/:id/status
// @desc    Update order status
// @access  Private
router.put('/:id/status', protect, async (req, res) => {
    try {
        const { status, notes } = req.body;

        const result = await orderService.updateOrderStatus(
            req.params.id,
            status,
            notes
        );

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   GET /api/orders/stats
// @desc    Get order statistics
// @access  Private
router.get('/analytics/stats', protect, async (req, res) => {
    try {
        const stats = await orderService.getOrderStats(req.user.id);

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

// @route   GET /api/orders/pincode/:pincode
// @desc    Get orders by pincode
// @access  Private
router.get('/pincode/:pincode', protect, async (req, res) => {
    try {
        const orders = await orderService.getOrdersByPincode(req.params.pincode);

        res.json({
            success: true,
            data: orders
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
