/**
 * ═══════════════════════════════════════════════════════════════
 * CONTACT LISTS ROUTES - Group Management
 * Features: Create, Manage, Merge Lists, Smart Filters
 * ═══════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const ContactList = require('../models/ContactList');
const Contact = require('../models/Contact');
const { protect, checkPermission } = require('../middleware/auth');

// ═══════════════════════════════════════════════════════════════
// GET ALL LISTS
// ═══════════════════════════════════════════════════════════════
router.get('/', protect, async (req, res) => {
    try {
        const { page = 1, limit = 20, status, search, sortBy = 'createdAt', order = 'desc' } = req.query;

        const query = { user: req.userId };
        if (status) query.status = status;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const lists = await ContactList.find(query)
            .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        const total = await ContactList.countDocuments(query);

        res.json({
            success: true,
            data: lists,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get lists error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch lists' });
    }
});

// ═══════════════════════════════════════════════════════════════
// GET SINGLE LIST WITH CONTACTS
// ═══════════════════════════════════════════════════════════════
router.get('/:id', protect, async (req, res) => {
    try {
        const { includeContacts = 'false', page = 1, limit = 50 } = req.query;

        const list = await ContactList.findOne({
            _id: req.params.id,
            user: req.userId
        }).lean();

        if (!list) {
            return res.status(404).json({ success: false, error: 'List not found' });
        }

        if (includeContacts === 'true') {
            const contacts = await Contact.find({
                _id: { $in: list.contacts }
            })
            .select('phoneNumber name email tags status')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

            list.contactsData = contacts;
            list.contactsPagination = {
                page: parseInt(page),
                limit: parseInt(limit),
                total: list.contacts.length,
                pages: Math.ceil(list.contacts.length / limit)
            };
        }

        res.json({ success: true, data: list });

    } catch (error) {
        console.error('Get list error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch list' });
    }
});

// ═══════════════════════════════════════════════════════════════
// CREATE LIST
// ═══════════════════════════════════════════════════════════════
router.post('/', protect, checkPermission('manage_contacts'), async (req, res) => {
    try {
        const { name, description, tags, contactIds } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'List name is required' });
        }

        const list = new ContactList({
            user: req.userId,
            name,
            description,
            tags,
            contacts: contactIds || [],
            totalContacts: contactIds ? contactIds.length : 0
        });

        await list.save();

        // Update contacts
        if (contactIds && contactIds.length > 0) {
            await Contact.updateMany(
                { _id: { $in: contactIds }, user: req.userId },
                { $addToSet: { lists: list._id } }
            );
        }

        res.status(201).json({
            success: true,
            message: 'List created successfully',
            data: list
        });

    } catch (error) {
        console.error('Create list error:', error);
        res.status(500).json({ success: false, error: 'Failed to create list' });
    }
});

// ═══════════════════════════════════════════════════════════════
// UPDATE LIST
// ═══════════════════════════════════════════════════════════════
router.put('/:id', protect, async (req, res) => {
    try {
        const list = await ContactList.findOne({
            _id: req.params.id,
            user: req.userId
        });

        if (!list) {
            return res.status(404).json({ success: false, error: 'List not found' });
        }

        const allowedUpdates = ['name', 'description', 'tags', 'status'];
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                list[field] = req.body[field];
            }
        });

        await list.save();

        res.json({
            success: true,
            message: 'List updated successfully',
            data: list
        });

    } catch (error) {
        console.error('Update list error:', error);
        res.status(500).json({ success: false, error: 'Failed to update list' });
    }
});

// ═══════════════════════════════════════════════════════════════
// DELETE LIST
// ═══════════════════════════════════════════════════════════════
router.delete('/:id', protect, async (req, res) => {
    try {
        const list = await ContactList.findOne({
            _id: req.params.id,
            user: req.userId
        });

        if (!list) {
            return res.status(404).json({ success: false, error: 'List not found' });
        }

        // Remove list reference from contacts
        await Contact.updateMany(
            { lists: list._id },
            { $pull: { lists: list._id } }
        );

        await list.remove();

        res.json({
            success: true,
            message: 'List deleted successfully'
        });

    } catch (error) {
        console.error('Delete list error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete list' });
    }
});

// ═══════════════════════════════════════════════════════════════
// ADD CONTACTS TO LIST
// ═══════════════════════════════════════════════════════════════
router.post('/:id/contacts', protect, async (req, res) => {
    try {
        const { contactIds } = req.body;

        if (!contactIds || !Array.isArray(contactIds)) {
            return res.status(400).json({ success: false, error: 'Contact IDs array required' });
        }

        const list = await ContactList.findOne({
            _id: req.params.id,
            user: req.userId
        });

        if (!list) {
            return res.status(404).json({ success: false, error: 'List not found' });
        }

        let added = 0;
        for (const contactId of contactIds) {
            if (!list.contacts.includes(contactId)) {
                await list.addContact(contactId);
                await Contact.findByIdAndUpdate(contactId, {
                    $addToSet: { lists: list._id }
                });
                added++;
            }
        }

        res.json({
            success: true,
            message: `${added} contacts added to list`,
            data: list
        });

    } catch (error) {
        console.error('Add contacts error:', error);
        res.status(500).json({ success: false, error: 'Failed to add contacts' });
    }
});

// ═══════════════════════════════════════════════════════════════
// REMOVE CONTACTS FROM LIST
// ═══════════════════════════════════════════════════════════════
router.delete('/:id/contacts', protect, async (req, res) => {
    try {
        const { contactIds } = req.body;

        if (!contactIds || !Array.isArray(contactIds)) {
            return res.status(400).json({ success: false, error: 'Contact IDs array required' });
        }

        const list = await ContactList.findOne({
            _id: req.params.id,
            user: req.userId
        });

        if (!list) {
            return res.status(404).json({ success: false, error: 'List not found' });
        }

        for (const contactId of contactIds) {
            await list.removeContact(contactId);
            await Contact.findByIdAndUpdate(contactId, {
                $pull: { lists: list._id }
            });
        }

        res.json({
            success: true,
            message: `${contactIds.length} contacts removed from list`,
            data: list
        });

    } catch (error) {
        console.error('Remove contacts error:', error);
        res.status(500).json({ success: false, error: 'Failed to remove contacts' });
    }
});

// ═══════════════════════════════════════════════════════════════
// MERGE LISTS
// ═══════════════════════════════════════════════════════════════
router.post('/merge', protect, async (req, res) => {
    try {
        const { sourceListIds, targetName, removeDuplicates = true } = req.body;

        if (!sourceListIds || sourceListIds.length < 2) {
            return res.status(400).json({ 
                success: false, 
                error: 'At least 2 source lists required' 
            });
        }

        const sourceLists = await ContactList.find({
            _id: { $in: sourceListIds },
            user: req.userId
        });

        if (sourceLists.length !== sourceListIds.length) {
            return res.status(404).json({ success: false, error: 'Some lists not found' });
        }

        // Collect all contacts
        let allContacts = [];
        sourceLists.forEach(list => {
            allContacts = allContacts.concat(list.contacts);
        });

        // Remove duplicates if requested
        if (removeDuplicates) {
            allContacts = [...new Set(allContacts.map(c => c.toString()))];
        }

        // Create merged list
        const mergedList = new ContactList({
            user: req.userId,
            name: targetName || `Merged List ${Date.now()}`,
            description: `Merged from ${sourceLists.length} lists`,
            contacts: allContacts,
            totalContacts: allContacts.length
        });

        await mergedList.save();

        res.json({
            success: true,
            message: 'Lists merged successfully',
            data: {
                mergedList,
                totalContacts: allContacts.length,
                duplicatesRemoved: removeDuplicates
            }
        });

    } catch (error) {
        console.error('Merge lists error:', error);
        res.status(500).json({ success: false, error: 'Failed to merge lists' });
    }
});

module.exports = router;
