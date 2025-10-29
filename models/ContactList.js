const mongoose = require('mongoose');

/**
 * ═══════════════════════════════════════════════════════════════
 * CONTACT LIST MODEL - Group Management
 * ═══════════════════════════════════════════════════════════════
 */

const contactListSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    
    name: {
        type: String,
        required: [true, 'List name is required'],
        trim: true,
        maxlength: [100, 'List name cannot exceed 100 characters']
    },
    
    description: String,
    
    contacts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contact'
    }],
    
    totalContacts: {
        type: Number,
        default: 0
    },
    
    tags: [String],
    
    status: {
        type: String,
        enum: ['active', 'archived'],
        default: 'active'
    },
    
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

contactListSchema.index({ user: 1, name: 1 });

contactListSchema.methods.addContact = async function(contactId) {
    if (!this.contacts.includes(contactId)) {
        this.contacts.push(contactId);
        this.totalContacts += 1;
        return await this.save();
    }
    return this;
};

contactListSchema.methods.removeContact = async function(contactId) {
    this.contacts = this.contacts.filter(id => id.toString() !== contactId.toString());
    this.totalContacts = this.contacts.length;
    return await this.save();
};

module.exports = mongoose.model('ContactList', contactListSchema);
