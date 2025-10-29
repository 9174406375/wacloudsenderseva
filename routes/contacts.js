/**
 * ═══════════════════════════════════════════════════════════════
 * CONTACTS ROUTES - ENTERPRISE EDITION
 * Features: CRUD, Excel Import/Export, Bulk Operations, Analytics
 * ═══════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const Contact = require('../models/Contact');
const ContactList = require('../models/ContactList');
const { protect, checkPermission } = require('../middleware/auth');

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/csv'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only Excel and CSV files allowed.'));
        }
    }
});

// ═══════════════════════════════════════════════════════════════
// GET ALL CONTACTS (Advanced Filtering & Search)
// ═══════════════════════════════════════════════════════════════
router.get('/', protect, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            status,
            tags,
            lists,
            search,
            sortBy = 'createdAt',
            order = 'desc',
            optedIn,
            lastInteractionDays
        } = req.query;

        // Build query
        const query = { user: req.userId };
        
        if (status) query.status = status;
        if (optedIn !== undefined) query['preferences.optedIn'] = optedIn === 'true';
        
        if (tags) {
            const tagArray = tags.split(',');
            query.tags = { $in: tagArray };
        }
        
        if (lists) {
            const listArray = lists.split(',');
            query.lists = { $in: listArray };
        }
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { phoneNumber: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (lastInteractionDays) {
            const daysAgo = new Date();
            daysAgo.setDate(daysAgo.getDate() - parseInt(lastInteractionDays));
            query['engagement.lastInteraction'] = { $gte: daysAgo };
        }

        // Execute query
        const contacts = await Contact.find(query)
            .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('lists', 'name')
            .lean();

        const total = await Contact.countDocuments(query);

        // Get statistics
        const stats = await Contact.aggregate([
            { $match: { user: req.userId } },
            {
                $group: {
                    _id: null,
                    totalContacts: { $sum: 1 },
                    activeContacts: {
                        $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                    },
                    optedInContacts: {
                        $sum: { $cond: ['$preferences.optedIn', 1, 0] }
                    },
                    totalMessagesSent: { $sum: '$engagement.totalMessagesSent' }
                }
            }
        ]);

        res.json({
            success: true,
            data: contacts,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            },
            stats: stats[0] || {
                totalContacts: 0,
                activeContacts: 0,
                optedInContacts: 0,
                totalMessagesSent: 0
            }
        });

    } catch (error) {
        console.error('Get contacts error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch contacts'
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// GET SINGLE CONTACT
// ═══════════════════════════════════════════════════════════════
router.get('/:id', protect, async (req, res) => {
    try {
        const contact = await Contact.findOne({
            _id: req.params.id,
            user: req.userId
        })
        .populate('lists', 'name totalContacts')
        .lean();

        if (!contact) {
            return res.status(404).json({
                success: false,
                error: 'Contact not found'
            });
        }

        res.json({
            success: true,
            data: contact
        });

    } catch (error) {
        console.error('Get contact error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch contact'
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// CREATE SINGLE CONTACT
// ═══════════════════════════════════════════════════════════════
router.post('/', protect, checkPermission('manage_contacts'), async (req, res) => {
    try {
        const {
            phoneNumber,
            name,
            email,
            tags,
            lists,
            customFields,
            ...otherData
        } = req.body;

        // Validation
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }

        // Check if contact already exists
        const existing = await Contact.findOne({
            user: req.userId,
            phoneNumber
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                error: 'Contact with this phone number already exists'
            });
        }

        // Create contact
        const contact = new Contact({
            user: req.userId,
            phoneNumber,
            name,
            email,
            tags,
            lists,
            customFields,
            ...otherData,
            source: {
                type: 'manual',
                referrer: 'web'
            }
        });

        await contact.save();

        // Add to lists if specified
        if (lists && lists.length > 0) {
            await ContactList.updateMany(
                { _id: { $in: lists }, user: req.userId },
                { $addToSet: { contacts: contact._id }, $inc: { totalContacts: 1 } }
            );
        }

        // Update user stats
        const User = require('../models/User');
        await User.findByIdAndUpdate(req.userId, {
            $inc: { 'activity.contactsImported': 1 }
        });

        res.status(201).json({
            success: true,
            message: 'Contact created successfully',
            data: contact
        });

    } catch (error) {
        console.error('Create contact error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create contact'
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// UPDATE CONTACT
// ═══════════════════════════════════════════════════════════════
router.put('/:id', protect, async (req, res) => {
    try {
        const contact = await Contact.findOne({
            _id: req.params.id,
            user: req.userId
        });

        if (!contact) {
            return res.status(404).json({
                success: false,
                error: 'Contact not found'
            });
        }

        const allowedUpdates = [
            'name', 'email', 'company', 'jobTitle', 'website',
            'address', 'tags', 'customFields', 'notes', 'status'
        ];

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                contact[field] = req.body[field];
            }
        });

        // Handle list updates separately
        if (req.body.lists) {
            const oldLists = contact.lists.map(l => l.toString());
            const newLists = req.body.lists;

            // Remove from old lists
            const listsToRemove = oldLists.filter(l => !newLists.includes(l));
            if (listsToRemove.length > 0) {
                await ContactList.updateMany(
                    { _id: { $in: listsToRemove } },
                    { $pull: { contacts: contact._id }, $inc: { totalContacts: -1 } }
                );
            }

            // Add to new lists
            const listsToAdd = newLists.filter(l => !oldLists.includes(l));
            if (listsToAdd.length > 0) {
                await ContactList.updateMany(
                    { _id: { $in: listsToAdd }, user: req.userId },
                    { $addToSet: { contacts: contact._id }, $inc: { totalContacts: 1 } }
                );
            }

            contact.lists = newLists;
        }

        await contact.save();

        res.json({
            success: true,
            message: 'Contact updated successfully',
            data: contact
        });

    } catch (error) {
        console.error('Update contact error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update contact'
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// DELETE CONTACT
// ═══════════════════════════════════════════════════════════════
router.delete('/:id', protect, async (req, res) => {
    try {
        const contact = await Contact.findOne({
            _id: req.params.id,
            user: req.userId
        });

        if (!contact) {
            return res.status(404).json({
                success: false,
                error: 'Contact not found'
            });
        }

        // Remove from all lists
        await ContactList.updateMany(
            { contacts: contact._id },
            { $pull: { contacts: contact._id }, $inc: { totalContacts: -1 } }
        );

        await contact.remove();

        res.json({
            success: true,
            message: 'Contact deleted successfully'
        });

    } catch (error) {
        console.error('Delete contact error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete contact'
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// BULK DELETE CONTACTS
// ═══════════════════════════════════════════════════════════════
router.post('/bulk/delete', protect, async (req, res) => {
    try {
        const { contactIds } = req.body;

        if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Contact IDs array is required'
            });
        }

        // Remove from lists
        await ContactList.updateMany(
            { contacts: { $in: contactIds } },
            { $pull: { contacts: { $in: contactIds } } }
        );

        // Update totalContacts count for affected lists
        const affectedLists = await ContactList.find({
            user: req.userId,
            contacts: { $in: contactIds }
        });

        for (const list of affectedLists) {
            list.totalContacts = list.contacts.length;
            await list.save();
        }

        // Delete contacts
        const result = await Contact.deleteMany({
            _id: { $in: contactIds },
            user: req.userId
        });

        res.json({
            success: true,
            message: `${result.deletedCount} contacts deleted successfully`,
            deletedCount: result.deletedCount
        });

    } catch (error) {
        console.error('Bulk delete error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete contacts'
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// BULK UPDATE CONTACTS (Tags, Lists, Status)
// ═══════════════════════════════════════════════════════════════
router.post('/bulk/update', protect, async (req, res) => {
    try {
        const { contactIds, updates } = req.body;

        if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Contact IDs array is required'
            });
        }

        if (!updates || Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Updates object is required'
            });
        }

        const allowedFields = ['tags', 'status', 'lists'];
        const updateQuery = {};

        // Build update query
        Object.keys(updates).forEach(key => {
            if (allowedFields.includes(key)) {
                if (key === 'tags') {
                    updateQuery.$addToSet = { tags: { $each: updates.tags } };
                } else if (key === 'lists') {
                    // Handle lists separately
                } else {
                    updateQuery.$set = updateQuery.$set || {};
                    updateQuery.$set[key] = updates[key];
                }
            }
        });

        // Update contacts
        const result = await Contact.updateMany(
            { _id: { $in: contactIds }, user: req.userId },
            updateQuery
        );

        // Handle list updates
        if (updates.lists) {
            const contacts = await Contact.find({
                _id: { $in: contactIds },
                user: req.userId
            });

            for (const contact of contacts) {
                // Add to new lists
                await ContactList.updateMany(
                    { _id: { $in: updates.lists }, user: req.userId },
                    { $addToSet: { contacts: contact._id }, $inc: { totalContacts: 1 } }
                );

                contact.lists = [...new Set([...contact.lists, ...updates.lists])];
                await contact.save();
            }
        }

        res.json({
            success: true,
            message: `${result.modifiedCount} contacts updated successfully`,
            modifiedCount: result.modifiedCount
        });

    } catch (error) {
        console.error('Bulk update error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update contacts'
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// IMPORT CONTACTS FROM EXCEL/CSV
// ═══════════════════════════════════════════════════════════════
router.post('/import', protect, checkPermission('manage_contacts'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        // Parse Excel/CSV file
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        if (data.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'File is empty or invalid format'
            });
        }

        // Map column names (flexible mapping)
        const columnMap = {
            phoneNumber: ['phone', 'phoneNumber', 'mobile', 'number', 'Phone Number', 'Mobile'],
            name: ['name', 'fullName', 'Name', 'Full Name'],
            email: ['email', 'Email', 'Email Address'],
            company: ['company', 'Company', 'Organization'],
            tags: ['tags', 'Tags', 'Category']
        };

        const importResults = {
            total: data.length,
            success: 0,
            failed: 0,
            duplicates: 0,
            errors: []
        };

        const importBatchId = Date.now().toString();
        const contacts = [];

        // Process each row
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            
            try {
                // Find phone number in row
                let phoneNumber = null;
                for (const key of Object.keys(row)) {
                    if (columnMap.phoneNumber.some(col => key.toLowerCase().includes(col.toLowerCase()))) {
                        phoneNumber = String(row[key]).replace(/\D/g, '');
                        break;
                    }
                }

                if (!phoneNumber || phoneNumber.length < 10) {
                    importResults.failed++;
                    importResults.errors.push({
                        row: i + 2,
                        error: 'Invalid or missing phone number'
                    });
                    continue;
                }

                // Check for duplicate
                const existing = await Contact.findOne({
                    user: req.userId,
                    phoneNumber
                });

                if (existing) {
                    importResults.duplicates++;
                    continue;
                }

                // Extract other fields
                const contactData = {
                    user: req.userId,
                    phoneNumber,
                    source: {
                        type: 'import',
                        importBatch: importBatchId
                    }
                };

                // Map name
                for (const key of Object.keys(row)) {
                    if (columnMap.name.some(col => key.toLowerCase().includes(col.toLowerCase()))) {
                        contactData.name = String(row[key]).trim();
                        break;
                    }
                }

                // Map email
                for (const key of Object.keys(row)) {
                    if (columnMap.email.some(col => key.toLowerCase().includes(col.toLowerCase()))) {
                        contactData.email = String(row[key]).toLowerCase().trim();
                        break;
                    }
                }

                // Map company
                for (const key of Object.keys(row)) {
                    if (columnMap.company.some(col => key.toLowerCase().includes(col.toLowerCase()))) {
                        contactData.company = String(row[key]).trim();
                        break;
                    }
                }

                // Map tags
                for (const key of Object.keys(row)) {
                    if (columnMap.tags.some(col => key.toLowerCase().includes(col.toLowerCase()))) {
                        const tagValue = String(row[key]);
                        contactData.tags = tagValue.split(',').map(t => t.trim()).filter(t => t);
                        break;
                    }
                }

                contacts.push(contactData);
                importResults.success++;

            } catch (error) {
                importResults.failed++;
                importResults.errors.push({
                    row: i + 2,
                    error: error.message
                });
            }
        }

        // Bulk insert contacts
        if (contacts.length > 0) {
            await Contact.insertMany(contacts, { ordered: false }).catch(err => {
                // Handle any remaining duplicates
                console.log('Some duplicates found during insert:', err.writeErrors?.length || 0);
            });

            // Update user stats
            const User = require('../models/User');
            await User.findByIdAndUpdate(req.userId, {
                $inc: { 'activity.contactsImported': contacts.length }
            });
        }

        res.json({
            success: true,
            message: `Import completed: ${importResults.success} contacts added`,
            results: importResults
        });

    } catch (error) {
        console.error('Import contacts error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to import contacts: ' + error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// EXPORT CONTACTS TO EXCEL
// ═══════════════════════════════════════════════════════════════
router.get('/export/excel', protect, async (req, res) => {
    try {
        const { status, tags, lists } = req.query;

        // Build query
        const query = { user: req.userId };
        if (status) query.status = status;
        if (tags) query.tags = { $in: tags.split(',') };
        if (lists) query.lists = { $in: lists.split(',') };

        // Fetch contacts
        const contacts = await Contact.find(query)
            .select('phoneNumber name email company tags status engagement createdAt')
            .lean();

        if (contacts.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No contacts found to export'
            });
        }

        // Prepare data for Excel
        const excelData = contacts.map(contact => ({
            'Phone Number': contact.phoneNumber,
            'Name': contact.name || '',
            'Email': contact.email || '',
            'Company': contact.company || '',
            'Tags': Array.isArray(contact.tags) ? contact.tags.join(', ') : '',
            'Status': contact.status,
            'Total Messages Sent': contact.engagement?.totalMessagesSent || 0,
            'Last Interaction': contact.engagement?.lastInteraction 
                ? new Date(contact.engagement.lastInteraction).toLocaleDateString() 
                : '',
            'Created Date': new Date(contact.createdAt).toLocaleDateString()
        }));

        // Create workbook
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');

        // Set column widths
        worksheet['!cols'] = [
            { wch: 15 }, // Phone Number
            { wch: 25 }, // Name
            { wch: 30 }, // Email
            { wch: 20 }, // Company
            { wch: 20 }, // Tags
            { wch: 12 }, // Status
            { wch: 18 }, // Messages Sent
            { wch: 15 }, // Last Interaction
            { wch: 15 }  // Created Date
        ];

        // Generate Excel file
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Send file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=contacts-${Date.now()}.xlsx`);
        res.send(excelBuffer);

    } catch (error) {
        console.error('Export contacts error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export contacts'
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// GET CONTACT ANALYTICS
// ═══════════════════════════════════════════════════════════════
router.get('/analytics/overview', protect, async (req, res) => {
    try {
        const { period = '30' } = req.query;
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(period));

        const analytics = await Contact.aggregate([
            { $match: { user: req.userId } },
            {
                $facet: {
                    overview: [
                        {
                            $group: {
                                _id: null,
                                total: { $sum: 1 },
                                active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
                                optedIn: { $sum: { $cond: ['$preferences.optedIn', 1, 0] } },
                                unsubscribed: { $sum: { $cond: [{ $eq: ['$status', 'unsubscribed'] }, 1, 0] } }
                            }
                        }
                    ],
                    byStatus: [
                        { $group: { _id: '$status', count: { $sum: 1 } } },
                        { $sort: { count: -1 } }
                    ],
                    byTags: [
                        { $unwind: '$tags' },
                        { $group: { _id: '$tags', count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 10 }
                    ],
                    recentActivity: [
                        {
                            $match: {
                                'engagement.lastInteraction': { $gte: daysAgo }
                            }
                        },
                        {
                            $group: {
                                _id: {
                                    $dateToString: {
                                        format: '%Y-%m-%d',
                                        date: '$engagement.lastInteraction'
                                    }
                                },
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { _id: 1 } }
                    ],
                    topEngaged: [
                        { $sort: { 'engagement.totalMessagesSent': -1 } },
                        { $limit: 10 },
                        {
                            $project: {
                                phoneNumber: 1,
                                name: 1,
                                totalMessages: '$engagement.totalMessagesSent',
                                lastInteraction: '$engagement.lastInteraction'
                            }
                        }
                    ]
                }
            }
        ]);

        res.json({
            success: true,
            data: analytics[0]
        });

    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch analytics'
        });
    }
});

module.exports = router;
