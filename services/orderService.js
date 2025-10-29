/**
 * ═══════════════════════════════════════════════════════════════
 * ORDER MANAGEMENT SERVICE - From Yesterday's Work
 * Auto-reply orders, admin pairing notification
 * ═══════════════════════════════════════════════════════════════
 */

const Order = require('../models/Order');

// Order status colors
const STATUS_COLORS = {
    pending: 'yellow',
    confirmed: 'green',
    cancelled: 'red',
    delivered: 'blue'
};

/**
 * Create new order from WhatsApp message
 */
async function createOrder(userId, customerPhone, customerName, orderDetails) {
    try {
        const order = await Order.create({
            user: userId,
            customerPhone,
            customerName,
            orderDetails,
            status: 'pending',
            source: 'whatsapp'
        });

        // Auto-reply to customer
        const replyMessage = `
✅ *Order Received!*

📋 Order ID: ${order._id}
👤 Customer: ${customerName}
📱 Phone: ${customerPhone}

📦 Order Details:
${orderDetails}

⏰ Time: ${new Date().toLocaleTimeString('en-IN')}

We'll confirm your order shortly.

Thank you for ordering! 🙏
        `.trim();

        return {
            success: true,
            order,
            replyMessage
        };

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get order status with color
 */
async function getOrderStatus(orderId) {
    try {
        const order = await Order.findById(orderId);
        
        if (!order) {
            return { success: false, error: 'Order not found' };
        }

        return {
            success: true,
            order,
            color: STATUS_COLORS[order.status] || 'gray'
        };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Update order status
 */
async function updateOrderStatus(orderId, newStatus, io) {
    try {
        const order = await Order.findByIdAndUpdate(
            orderId,
            { status: newStatus, updatedAt: Date.now() },
            { new: true }
        );

        // Emit real-time update
        if (io) {
            io.to(`user_${order.user}`).emit('order:updated', {
                orderId: order._id,
                status: newStatus,
                color: STATUS_COLORS[newStatus],
                timestamp: Date.now()
            });
        }

        return { success: true, order };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Get all user orders
 */
async function getUserOrders(userId, filters = {}) {
    try {
        const query = { user: userId };
        
        if (filters.status) query.status = filters.status;
        if (filters.customerPhone) query.customerPhone = filters.customerPhone;

        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .limit(100);

        return {
            success: true,
            orders,
            count: orders.length
        };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    createOrder,
    getOrderStatus,
    updateOrderStatus,
    getUserOrders
};
