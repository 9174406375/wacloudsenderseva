/**
 * ================================================
 * WA CLOUD SENDER SEVA - BOOK ORDER SYSTEM V2
 * Version: 2.1.0 | Professional Order Management
 * Complete Reports: Daily, Weekly, Monthly, Yearly
 * Delivery: Within 30 Days
 * ================================================
 */

const pino = require('pino');
const crypto = require('crypto');

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard'
        }
    }
});

class BookOrderSystem {
    constructor(database, waManager, pincodeHandler, io) {
        this.database = database;
        this.waManager = waManager;
        this.pincodeHandler = pincodeHandler;
        this.io = io;
        
        this.bookDetails = {
            title: {
                hindi: 'ज्ञान गंगा - संत रामपाल जी महाराज',
                english: 'Gyan Ganga - Sant Rampal Ji Maharaj'
            },
            description: {
                hindi: 'सभी धर्मों के पवित्र ग्रंथों का सटीक वर्णन',
                english: 'Accurate Description of All Religious Scriptures'
            },
            price: 0,
            deliveryCharge: 0,
            maxQuantity: 5,
            deliveryDays: 30
        };

        logger.info('Book Order System V2 initialized');
    }

    generateOrderId() {
        const timestamp = Date.now();
        const random = crypto.randomBytes(3).toString('hex').toUpperCase();
        return `BO${timestamp}${random}`;
    }

    async createOrder(orderData) {
        try {
            const {
                userId, name, phone, address, pincode,
                state, district, city, village, postOffice,
                quantity, language
            } = orderData;

            logger.info(`Creating book order for: ${name} (${phone})`);

            if (quantity < 1 || quantity > this.bookDetails.maxQuantity) {
                throw new Error(`Quantity must be between 1 and ${this.bookDetails.maxQuantity}`);
            }

            const pincodeResult = await this.pincodeHandler.searchPincode(pincode);
            if (!pincodeResult.success) {
                throw new Error('Invalid PIN code');
            }

            const orderId = this.generateOrderId();

            const order = {
                orderId,
                userId,
                customerDetails: {
                    name,
                    phone,
                    language: language || 'hindi'
                },
                address: {
                    fullAddress: address,
                    village,
                    postOffice,
                    city,
                    district,
                    state,
                    pincode,
                    country: 'India'
                },
                bookDetails: {
                    title: this.bookDetails.title[language || 'hindi'],
                    quantity,
                    pricePerBook: 0,
                    totalPrice: 0,
                    deliveryCharge: 0
                },
                status: 'pending',
                statusHistory: [
                    {
                        status: 'pending',
                        timestamp: new Date(),
                        note: 'Order placed successfully'
                    }
                ],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await this.database.createBookOrder(order);

            logger.info(`✅ Order created: ${orderId}`);

            await this.sendOrderConfirmation(order);
            await this.notifyAdmin(order);

            return {
                success: true,
                orderId,
                order,
                message: language === 'hindi' ? 
                    'आपका ऑर्डर सफलतापूर्वक प्राप्त हुआ!' :
                    'Your order has been placed successfully!'
            };

        } catch (error) {
            logger.error('Error creating book order:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async sendOrderConfirmation(order) {
        try {
            const { customerDetails } = order;
            const language = customerDetails.language;

            const adminSession = await this.database.getAdminSession();
            if (!adminSession) {
                logger.warn('No admin session found');
                return;
            }

            const message = this.generateConfirmationMessage(order, language);

            await this.waManager.sendMessage(
                adminSession.sessionId,
                customerDetails.phone,
                message
            );

            logger.info(`✅ Order confirmation sent to ${customerDetails.phone}`);

        } catch (error) {
            logger.error('Error sending confirmation:', error);
        }
    }

    generateConfirmationMessage(order, language = 'hindi') {
        const { orderId, customerDetails, address, bookDetails } = order;

        if (language === 'hindi') {
            return `
✅ *आपका ऑर्डर सफलतापूर्वक प्राप्त हुआ!*

📚 *ऑर्डर विवरण:*
━━━━━━━━━━━━━━━━
🆔 ऑर्डर नंबर: *${orderId}*

📖 पुस्तक: *${bookDetails.title}*
📦 संख्या: *${bookDetails.quantity}*
💰 कीमत: *निःशुल्क (FREE)*
🚚 डिलीवरी: *निःशुल्क होम डिलीवरी*

👤 *ग्राहक जानकारी:*
━━━━━━━━━━━━━━━━
नाम: ${customerDetails.name}
मोबाइल: ${customerDetails.phone}

📍 *डिलीवरी पता:*
━━━━━━━━━━━━━━━━
${address.fullAddress}
${address.village ? address.village + ', ' : ''}${address.postOffice ? address.postOffice + ', ' : ''}
${address.city}, ${address.district}
${address.state} - ${address.pincode}

⏱️ *डिलीवरी समय:* 30 दिन के अंदर

📞 *हेल्पलाइन:* +91-XXXXXXXXXX

🔔 *नोट:* आपको WhatsApp पर डिलीवरी अपडेट मिलेंगे।

*धन्यवाद!*

━━━━━━━━━━━━━━━━
संत रामपाल जी महाराज
www.jagatgururampalji.org
`.trim();
        } else {
            return `
✅ *Your Order Confirmed Successfully!*

📚 *Order Details:*
━━━━━━━━━━━━━━━━
🆔 Order ID: *${orderId}*

📖 Book: *${bookDetails.title}*
📦 Quantity: *${bookDetails.quantity}*
💰 Price: *FREE*
🚚 Delivery: *FREE Home Delivery*

👤 *Customer Information:*
━━━━━━━━━━━━━━━━
Name: ${customerDetails.name}
Mobile: ${customerDetails.phone}

📍 *Delivery Address:*
━━━━━━━━━━━━━━━━
${address.fullAddress}
${address.village ? address.village + ', ' : ''}${address.postOffice ? address.postOffice + ', ' : ''}
${address.city}, ${address.district}
${address.state} - ${address.pincode}

⏱️ *Delivery Time:* Within 30 days

📞 *Helpline:* +91-XXXXXXXXXX

🔔 *Note:* You will receive delivery updates on WhatsApp.

*Thank You!*

━━━━━━━━━━━━━━━━
Sant Rampal Ji Maharaj
www.jagatgururampalji.org
`.trim();
        }
    }

    async notifyAdmin(order) {
        try {
            const { orderId, customerDetails, address, bookDetails } = order;

            const admin = await this.database.getAdminUser();
            if (!admin) return;

            this.io.emit('order:new', {
                orderId,
                customerName: customerDetails.name,
                quantity: bookDetails.quantity,
                location: `${address.city}, ${address.state}`,
                timestamp: new Date()
            });

            const adminSession = await this.database.getAdminSession();
            if (adminSession) {
                const adminMessage = `
🆕 *नया ऑर्डर प्राप्त!*

ऑर्डर ID: ${orderId}
नाम: ${customerDetails.name}
मोबाइल: ${customerDetails.phone}
पुस्तकें: ${bookDetails.quantity}
स्थान: ${address.city}, ${address.district}, ${address.state}

कृपया शीघ्र प्रक्रिया करें।
`.trim();

                await this.waManager.sendMessage(
                    adminSession.sessionId,
                    admin.whatsapp,
                    adminMessage
                );
            }

            logger.info('✅ Admin notified');

        } catch (error) {
            logger.error('Error notifying admin:', error);
        }
    }

    async updateOrderStatus(orderId, newStatus, note = '') {
        try {
            const validStatuses = ['pending', 'confirmed', 'dispatched', 'in_transit', 'delivered', 'cancelled'];
            
            if (!validStatuses.includes(newStatus)) {
                throw new Error('Invalid status');
            }

            const order = await this.database.getBookOrder(orderId);
            if (!order) {
                throw new Error('Order not found');
            }

            order.status = newStatus;
            order.updatedAt = new Date();
            
            order.statusHistory.push({
                status: newStatus,
                timestamp: new Date(),
                note: note || this.getDefaultStatusNote(newStatus, order.customerDetails.language)
            });

            await this.database.updateBookOrder(orderId, order);
            await this.sendStatusUpdate(order);

            return {
                success: true,
                orderId,
                newStatus
            };

        } catch (error) {
            logger.error('Error updating status:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    getDefaultStatusNote(status, language = 'hindi') {
        const notes = {
            hindi: {
                pending: 'आपका ऑर्डर प्राप्त हुआ',
                confirmed: 'ऑर्डर कन्फर्म हो गया',
                dispatched: 'पुस्तक डिस्पैच कर दी गई',
                in_transit: 'पुस्तक ट्रांजिट में है',
                delivered: 'पुस्तक डिलीवर हो गई',
                cancelled: 'ऑर्डर रद्द किया गया'
            },
            english: {
                pending: 'Order received',
                confirmed: 'Order confirmed',
                dispatched: 'Book dispatched',
                in_transit: 'Book in transit',
                delivered: 'Book delivered',
                cancelled: 'Order cancelled'
            }
        };

        return notes[language]?.[status] || notes.hindi[status];
    }

    async sendStatusUpdate(order) {
        try {
            const { orderId, customerDetails, status, statusHistory } = order;
            const language = customerDetails.language;
            const latestUpdate = statusHistory[statusHistory.length - 1];

            const adminSession = await this.database.getAdminSession();
            if (!adminSession) return;

            const statusEmojis = {
                pending: '⏳',
                confirmed: '✅',
                dispatched: '📦',
                in_transit: '🚚',
                delivered: '✅',
                cancelled: '❌'
            };

            const message = language === 'hindi' ? `
${statusEmojis[status]} *ऑर्डर अपडेट*

ऑर्डर ID: ${orderId}
स्थिति: *${this.getStatusText(status, language)}*

${latestUpdate.note}
`.trim() : `
${statusEmojis[status]} *Order Update*

Order ID: ${orderId}
Status: *${this.getStatusText(status, language)}*

${latestUpdate.note}
`.trim();

            await this.waManager.sendMessage(
                adminSession.sessionId,
                customerDetails.phone,
                message
            );

        } catch (error) {
            logger.error('Error sending status update:', error);
        }
    }

    getStatusText(status, language = 'hindi') {
        const statusTexts = {
            hindi: {
                pending: 'प्रक्रिया में',
                confirmed: 'कन्फर्म',
                dispatched: 'डिस्पैच किया गया',
                in_transit: 'ट्रांजिट में',
                delivered: 'डिलीवर हो गया',
                cancelled: 'रद्द किया गया'
            },
            english: {
                pending: 'Processing',
                confirmed: 'Confirmed',
                dispatched: 'Dispatched',
                in_transit: 'In Transit',
                delivered: 'Delivered',
                cancelled: 'Cancelled'
            }
        };

        return statusTexts[language]?.[status] || status;
    }

    // ============= REPORTS SYSTEM =============

    /**
     * Get today's orders report
     */
    async getTodayOrdersReport() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const orders = await this.database.getBookOrdersByDateRange(today, new Date());

            const report = {
                date: today,
                totalOrders: orders.length,
                totalBooks: orders.reduce((sum, o) => sum + o.bookDetails.quantity, 0),
                byStatus: this.groupByStatus(orders),
                byState: this.groupByState(orders),
                orders: orders
            };

            return {
                success: true,
                report
            };

        } catch (error) {
            logger.error('Error getting today report:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get weekly orders report
     */
    async getWeeklyOrdersReport() {
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);

            const orders = await this.database.getBookOrdersByDateRange(startDate, endDate);

            const report = {
                startDate,
                endDate,
                totalOrders: orders.length,
                totalBooks: orders.reduce((sum, o) => sum + o.bookDetails.quantity, 0),
                byStatus: this.groupByStatus(orders),
                byState: this.groupByState(orders),
                dailyBreakdown: this.getDailyBreakdown(orders, 7),
                orders: orders
            };

            return {
                success: true,
                report
            };

        } catch (error) {
            logger.error('Error getting weekly report:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get monthly orders report
     */
    async getMonthlyOrdersReport(month = null, year = null) {
        try {
            const now = new Date();
            const targetMonth = month || now.getMonth();
            const targetYear = year || now.getFullYear();

            const startDate = new Date(targetYear, targetMonth, 1);
            const endDate = new Date(targetYear, targetMonth + 1, 0);

            const orders = await this.database.getBookOrdersByDateRange(startDate, endDate);

            const report = {
                month: targetMonth + 1,
                year: targetYear,
                startDate,
                endDate,
                totalOrders: orders.length,
                totalBooks: orders.reduce((sum, o) => sum + o.bookDetails.quantity, 0),
                byStatus: this.groupByStatus(orders),
                byState: this.groupByState(orders),
                topCities: this.getTopCities(orders, 10),
                dailyBreakdown: this.getDailyBreakdown(orders, 31),
                orders: orders
            };

            return {
                success: true,
                report
            };

        } catch (error) {
            logger.error('Error getting monthly report:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get yearly orders report
     */
    async getYearlyOrdersReport(year = null) {
        try {
            const targetYear = year || new Date().getFullYear();

            const startDate = new Date(targetYear, 0, 1);
            const endDate = new Date(targetYear, 11, 31);

            const orders = await this.database.getBookOrdersByDateRange(startDate, endDate);

            const report = {
                year: targetYear,
                startDate,
                endDate,
                totalOrders: orders.length,
                totalBooks: orders.reduce((sum, o) => sum + o.bookDetails.quantity, 0),
                byStatus: this.groupByStatus(orders),
                byState: this.groupByState(orders),
                monthlyBreakdown: this.getMonthlyBreakdown(orders),
                topStates: this.getTopStates(orders, 10),
                topCities: this.getTopCities(orders, 20),
                orders: orders
            };

            return {
                success: true,
                report
            };

        } catch (error) {
            logger.error('Error getting yearly report:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Helper: Group by status
     */
    groupByStatus(orders) {
        const grouped = {
            pending: 0,
            confirmed: 0,
            dispatched: 0,
            in_transit: 0,
            delivered: 0,
            cancelled: 0
        };

        orders.forEach(order => {
            if (grouped.hasOwnProperty(order.status)) {
                grouped[order.status]++;
            }
        });

        return grouped;
    }

    /**
     * Helper: Group by state
     */
    groupByState(orders) {
        const grouped = {};

        orders.forEach(order => {
            const state = order.address.state;
            if (!grouped[state]) {
                grouped[state] = 0;
            }
            grouped[state]++;
        });

        return grouped;
    }

    /**
     * Helper: Get top cities
     */
    getTopCities(orders, limit = 10) {
        const cityCount = {};

        orders.forEach(order => {
            const city = order.address.city;
            cityCount[city] = (cityCount[city] || 0) + 1;
        });

        return Object.entries(cityCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([city, count]) => ({ city, count }));
    }

    /**
     * Helper: Get top states
     */
    getTopStates(orders, limit = 10) {
        const stateCount = {};

        orders.forEach(order => {
            const state = order.address.state;
            stateCount[state] = (stateCount[state] || 0) + 1;
        });

        return Object.entries(stateCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([state, count]) => ({ state, count }));
    }

    /**
     * Helper: Get daily breakdown
     */
    getDailyBreakdown(orders, days) {
        const breakdown = [];
        const today = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const dayOrders = orders.filter(order => {
                const orderDate = new Date(order.createdAt);
                orderDate.setHours(0, 0, 0, 0);
                return orderDate.getTime() === date.getTime();
            });

            breakdown.push({
                date: date.toISOString().split('T')[0],
                orders: dayOrders.length,
                books: dayOrders.reduce((sum, o) => sum + o.bookDetails.quantity, 0)
            });
        }

        return breakdown;
    }

    /**
     * Helper: Get monthly breakdown
     */
    getMonthlyBreakdown(orders) {
        const breakdown = [];

        for (let month = 0; month < 12; month++) {
            const monthOrders = orders.filter(order => {
                const orderDate = new Date(order.createdAt);
                return orderDate.getMonth() === month;
            });

            breakdown.push({
                month: month + 1,
                monthName: new Date(2025, month).toLocaleString('en', { month: 'long' }),
                orders: monthOrders.length,
                books: monthOrders.reduce((sum, o) => sum + o.bookDetails.quantity, 0)
            });
        }

        return breakdown;
    }

    async getUserOrders(userId) {
        try {
            const orders = await this.database.getBookOrdersByUser(userId);
            return {
                success: true,
                orders,
                totalOrders: orders.length
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async cancelOrder(orderId, reason = '') {
        return await this.updateOrderStatus(orderId, 'cancelled', reason);
    }
}

module.exports = BookOrderSystem;

/**
 * ================================================
 * 🎉 BOOK ORDER SYSTEM V2 COMPLETE!
 * Lines: ~850+
 * Features: Complete Reports System
 * Daily/Weekly/Monthly/Yearly Reports ✅
 * 30 Days Delivery ✅
 * Professional Messages ✅
 * ================================================
 */
