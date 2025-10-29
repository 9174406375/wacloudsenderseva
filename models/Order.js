const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderNumber: { type: String, unique: true, required: true },
    
    // Customer Details
    customer: {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        whatsappNumber: String,
        email: String,
        alternatePhone: String
    },
    
    // Delivery Address (Pincode-based)
    deliveryAddress: {
        addressLine1: { type: String, required: true },
        addressLine2: String,
        landmark: String,
        pincode: { type: String, required: true },
        city: { type: String, required: true },
        district: String,
        state: { type: String, required: true },
        country: { type: String, default: 'India' }
    },
    
    // Book Details
    books: [{
        bookName: { type: String, default: 'Gyan Ganga' },
        quantity: { type: Number, default: 1 },
        language: { type: String, enum: ['Hindi', 'English', 'Punjabi', 'Bengali', 'Marathi'], default: 'Hindi' },
        price: { type: Number, default: 0 },
        isbn: String
    }],
    
    // Order Status
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'failed'],
        default: 'pending'
    },
    
    // Payment Details
    payment: {
        method: { type: String, enum: ['cod', 'online', 'free'], default: 'free' },
        status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
        amount: { type: Number, default: 0 },
        transactionId: String,
        paidAt: Date
    },
    
    // Shipping Details
    shipping: {
        carrier: String,
        trackingNumber: String,
        shippedAt: Date,
        estimatedDelivery: Date,
        actualDelivery: Date,
        charges: { type: Number, default: 0 }
    },
    
    // WhatsApp Communication
    whatsappMessages: [{
        type: { type: String, enum: ['order_confirmation', 'status_update', 'delivery_notification', 'follow_up'] },
        message: String,
        sentAt: Date,
        status: { type: String, enum: ['sent', 'delivered', 'read', 'failed'], default: 'sent' }
    }],
    
    // Order Notes
    notes: {
        customer: String,
        admin: String,
        internal: String
    },
    
    // Order Source
    source: {
        type: String,
        enum: ['whatsapp', 'web', 'admin', 'bulk_import'],
        default: 'whatsapp'
    },
    
    // Timestamps
    orderedAt: { type: Date, default: Date.now },
    confirmedAt: Date,
    shippedAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ 'customer.phone': 1 });
orderSchema.index({ 'deliveryAddress.pincode': 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ orderedAt: -1 });

// Generate order number
orderSchema.pre('save', async function(next) {
    if (!this.orderNumber) {
        const count = await mongoose.model('Order').countDocuments();
        this.orderNumber = `ORD-${Date.now()}-${(count + 1).toString().padStart(5, '0')}`;
    }
    this.updatedAt = Date.now();
    next();
});

// Send WhatsApp notification
orderSchema.methods.sendWhatsAppNotification = async function(type, message) {
    this.whatsappMessages.push({
        type,
        message,
        sentAt: new Date(),
        status: 'sent'
    });
    await this.save();
};

module.exports = mongoose.model('Order', orderSchema);
