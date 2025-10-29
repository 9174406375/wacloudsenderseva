/**
 * ═══════════════════════════════════════════════════════════════
 * ORDER MODEL - WhatsApp Order Management
 * ═══════════════════════════════════════════════════════════════
 */

const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    customerPhone: {
        type: String,
        required: true
    },
    customerName: {
        type: String,
        required: true
    },
    orderDetails: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'delivered'],
        default: 'pending'
    },
    source: {
        type: String,
        default: 'whatsapp'
    },
    amount: {
        type: Number,
        default: 0
    },
    notes: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Order', orderSchema);
