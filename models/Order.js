const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        unique: true,
        required: true
    },
    customerName: {
        type: String,
        required: true
    },
    customerPhone: {
        type: String,
        required: true
    },
    customerEmail: {
        type: String
    },
    items: [{
        bookName: String,
        author: String,
        quantity: Number,
        price: Number
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    address: {
        street: String,
        city: String,
        state: String,
        pincode: String,
        country: { type: String, default: 'India' }
    },
    paymentMethod: {
        type: String,
        enum: ['cod', 'online', 'upi', 'card'],
        default: 'cod'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    orderStatus: {
        type: String,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
        default: 'pending'
    },
    trackingNumber: {
        type: String
    },
    notes: {
        type: String
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Auto-generate order number
orderSchema.pre('save', async function(next) {
    if (!this.orderNumber) {
        const count = await mongoose.model('Order').countDocuments();
        this.orderNumber = `ORD${Date.now()}${count + 1}`;
    }
    next();
});

module.exports = mongoose.model('Order', orderSchema);
