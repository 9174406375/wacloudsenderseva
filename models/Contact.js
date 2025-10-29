const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: String,
    tags: [String],
    createdAt: { type: Date, default: Date.now }
});

contactSchema.index({ userId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model('Contact', contactSchema);
