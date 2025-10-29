const Order = require('../models/Order');
const whatsappService = require('./whatsappService');
const moment = require('moment-timezone');

class OrderService {
    // Create new order
    async createOrder(orderData) {
        try {
            const order = new Order(orderData);
            await order.save();

            // Send WhatsApp confirmation
            await this.sendOrderConfirmation(order);

            return { success: true, order };
        } catch (error) {
            console.error('Create order error:', error);
            return { success: false, error: error.message };
        }
    }

    // Send order confirmation message
    async sendOrderConfirmation(order) {
        const message = `
🙏 *जय गुरुदेव जी!*

आपका ऑर्डर सफलतापूर्वक रजिस्टर हो गया है।

📋 *Order Details:*
Order No: ${order.orderNumber}
Book: ${order.books.map(b => b.bookName).join(', ')}
Quantity: ${order.books.reduce((sum, b) => sum + b.quantity, 0)}
Language: ${order.books[0]?.language || 'Hindi'}

📍 *Delivery Address:*
${order.customer.name}
${order.deliveryAddress.addressLine1}
${order.deliveryAddress.addressLine2 || ''}
${order.deliveryAddress.city}, ${order.deliveryAddress.state}
PIN: ${order.deliveryAddress.pincode}

📱 Contact: ${order.customer.phone}

✅ आपकी पुस्तक जल्द ही आपके पते पर भेज दी जाएगी।

धन्यवाद! 🙏
Sant Rampal Ji Maharaj`;

        return await whatsappService.sendMessage(
            order.customer.phone,
            message.trim()
        );
    }

    // Update order status
    async updateOrderStatus(orderId, status, notes = '') {
        try {
            const order = await Order.findById(orderId);
            if (!order) {
                return { success: false, error: 'Order not found' };
            }

            order.status = status;
            
            // Update timestamps
            if (status === 'confirmed') order.confirmedAt = new Date();
            if (status === 'shipped') order.shippedAt = new Date();
            if (status === 'delivered') order.deliveredAt = new Date();
            if (status === 'cancelled') order.cancelledAt = new Date();

            if (notes) {
                order.notes.admin = notes;
            }

            await order.save();

            // Send status update to customer
            await this.sendStatusUpdate(order);

            return { success: true, order };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Send order status update
    async sendStatusUpdate(order) {
        const statusMessages = {
            confirmed: `✅ आपका ऑर्डर *${order.orderNumber}* कन्फर्म हो गया है। जल्द ही आपकी पुस्तक भेजी जाएगी।`,
            processing: `📦 आपका ऑर्डर *${order.orderNumber}* प्रोसेस हो रहा है।`,
            shipped: `🚚 आपकी पुस्तक भेज दी गई है!\n\nTracking: ${order.shipping.trackingNumber || 'N/A'}\nEstimated Delivery: ${moment(order.shipping.estimatedDelivery).format('DD MMM YYYY')}`,
            delivered: `✅ आपकी पुस्तक डिलीवर हो गई है। आशा है आपको पुस्तक पसंद आएगी। 🙏`,
            cancelled: `❌ आपका ऑर्डर *${order.orderNumber}* कैंसल कर दिया गया है।\nकारण: ${order.notes.admin || 'Not specified'}`
        };

        const message = `
🙏 *Order Update*

${statusMessages[order.status]}

Order No: ${order.orderNumber}
Customer: ${order.customer.name}

धन्यवाद!
Sant Rampal Ji Maharaj`;

        return await whatsappService.sendMessage(
            order.customer.phone,
            message.trim()
        );
    }

    // Get orders by pincode
    async getOrdersByPincode(pincode) {
        return await Order.find({ 'deliveryAddress.pincode': pincode })
            .sort('-orderedAt')
            .populate('userId', 'name email');
    }

    // Get order statistics
    async getOrderStats(userId = null) {
        const query = userId ? { userId } : {};
        
        const stats = await Order.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        return stats.reduce((acc, stat) => {
            acc[stat._id] = stat.count;
            return acc;
        }, {});
    }
}

module.exports = new OrderService();
