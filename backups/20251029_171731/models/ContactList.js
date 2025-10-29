const mongoose = require('mongoose');

const contactListSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    name: { type: String, required: true, trim: true },
    description: String,
    
    // Contacts in this list
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }],
    
    // Filters
    filters: {
        pincodes: [String],
        cities: [String],
        states: [String],
        tags: [String]
    },
    
    // Stats
    totalContacts: { type: Number, default: 0 },
    
    // Settings
    isActive: { type: Boolean, default: true },
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Update contact count
contactListSchema.pre('save', function(next) {
    this.totalContacts = this.contacts.length;
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('ContactList', contactListSchema);
