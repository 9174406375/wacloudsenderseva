const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { protect } = require('../middleware/auth');
const Contact = require('../models/Contact');
const path = require('path');
const fs = require('fs');

// Configure multer for file upload
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// @route   GET /api/contacts
// @desc    Get all contacts
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const { search, pincode, city, tags, page = 1, limit = 50 } = req.query;
        
        const query = { userId: req.user.id };
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (pincode) query['location.pincode'] = pincode;
        if (city) query['location.city'] = city;
        if (tags) query.tags = { $in: tags.split(',') };

        const contacts = await Contact.find(query)
            .sort('-createdAt')
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Contact.countDocuments(query);

        res.json({
            success: true,
            data: contacts,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   POST /api/contacts
// @desc    Create new contact
// @access  Private
router.post('/', protect, async (req, res) => {
    try {
        const contactData = {
            ...req.body,
            userId: req.user.id
        };

        const contact = await Contact.create(contactData);

        // Update user stats
        req.user.stats.totalContacts++;
        await req.user.save();

        res.status(201).json({
            success: true,
            message: 'Contact created successfully',
            data: contact
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ 
                success: false, 
                error: 'Contact with this phone number already exists' 
            });
        }
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   POST /api/contacts/import
// @desc    Import contacts from Excel/CSV
// @access  Private
router.post('/import', protect, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'Please upload a file' 
            });
        }

        const filePath = req.file.path;
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        const contacts = [];
        const errors = [];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            
            try {
                const contact = {
                    userId: req.user.id,
                    name: row.name || row.Name || row.NAME || 'Unknown',
                    phone: String(row.phone || row.Phone || row.PHONE || row.mobile || row.Mobile || ''),
                    email: row.email || row.Email || row.EMAIL || '',
                    location: {
                        pincode: row.pincode || row.Pincode || row.PINCODE || '',
                        city: row.city || row.City || row.CITY || '',
                        state: row.state || row.State || row.STATE || ''
                    },
                    tags: row.tags ? row.tags.split(',').map(t => t.trim()) : [],
                    source: 'import'
                };

                // Validate phone number
                if (!contact.phone || contact.phone.length < 10) {
                    errors.push({ row: i + 1, error: 'Invalid phone number' });
                    continue;
                }

                contacts.push(contact);

            } catch (error) {
                errors.push({ row: i + 1, error: error.message });
            }
        }

        // Bulk insert with error handling
        const inserted = [];
        for (const contact of contacts) {
            try {
                const newContact = await Contact.create(contact);
                inserted.push(newContact);
            } catch (error) {
                if (error.code === 11000) {
                    errors.push({ 
                        phone: contact.phone, 
                        error: 'Duplicate contact' 
                    });
                } else {
                    errors.push({ 
                        phone: contact.phone, 
                        error: error.message 
                    });
                }
            }
        }

        // Update user stats
        req.user.stats.totalContacts += inserted.length;
        await req.user.save();

        // Delete uploaded file
        fs.unlinkSync(filePath);

        res.json({
            success: true,
            message: `${inserted.length} contacts imported successfully`,
            data: {
                imported: inserted.length,
                failed: errors.length,
                errors: errors.slice(0, 10) // Show first 10 errors
            }
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   GET /api/contacts/:id
// @desc    Get single contact
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const contact = await Contact.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

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
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   PUT /api/contacts/:id
// @desc    Update contact
// @access  Private
router.put('/:id', protect, async (req, res) => {
    try {
        const contact = await Contact.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            req.body,
            { new: true, runValidators: true }
        );

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
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   DELETE /api/contacts/:id
// @desc    Delete contact
// @access  Private
router.delete('/:id', protect, async (req, res) => {
    try {
        const contact = await Contact.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!contact) {
            return res.status(404).json({ 
                success: false, 
                error: 'Contact not found' 
            });
        }

        res.json({
            success: true,
            message: 'Contact deleted successfully'
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   GET /api/contacts/stats/overview
// @desc    Get contact statistics
// @access  Private
router.get('/analytics/overview', protect, async (req, res) => {
    try {
        const total = await Contact.countDocuments({ userId: req.user.id });
        
        const byCity = await Contact.aggregate([
            { $match: { userId: req.user.id } },
            { $group: { _id: '$location.city', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        const byPincode = await Contact.aggregate([
            { $match: { userId: req.user.id } },
            { $group: { _id: '$location.pincode', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        res.json({
            success: true,
            data: {
                total,
                byCity,
                byPincode
            }
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
