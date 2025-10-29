/**
 * ═══════════════════════════════════════════════════════════════
 * ORDER ROUTES - Order Management API
 * ═══════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const orderService = require('../services/orderService');
const Order = require('../models/Order');

router.use(protect);

/**
 * GET /api/orders - Get all orders
 */
router.get('/', async (req, res) => {
    try {
        const { status, customerPhone } = req.query;
        const filters = {};
        
        if (status) filters.status = status;
        if (customerPhone) filters.customerPhone = customerPhone;

        const result = await orderService.getUserOrders(req.user._id, filters);
        res.json(result);

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/orders - Create new order
 */
router.post('/', async (req, res) => {
    try {
        const { customerPhone, customerName, orderDetails, amount } = req.body;

        const result = await orderService.createOrder(
            req.user._id,
            customerPhone,
            customerName,
            orderDetails
        );

        if (result.success) {
            res.status(201).json(result);
        } else {
            res.status(400).json(result);
        }

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/orders/:id/status - Update order status
 */
router.put('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const io = req.app.get('io');

        const result = await orderService.updateOrderStatus(req.params.id, status, io);
        res.json(result);

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/orders/:id - Delete order
 */
router.delete('/:id', async (req, res) => {
    try {
        await Order.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id
        });

        res.json({ success: true, message: 'Order deleted' });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
