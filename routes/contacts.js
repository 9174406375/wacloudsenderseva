/**
 * ═══════════════════════════════════════════════════════════════
 * CONTACT ROUTES - Excel Import/Export, Location Filter
 * ═══════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const Contact = require('../models/Contact');
const { protect } = require('../middleware/auth');

// File upload config
const upload = multer({ dest: 'uploads/' });

router.use(protect);

/**
 * GET /api/contacts - Get all contacts with filters
 */
router.get('/', async (req, res) => {
    try {
        const { city, village, pincode, search } = req.query;
        
        const query = { user: req.user._id };

        // Location filters
        if (city) query['location.city'] = new RegExp(city, 'i');
        if (village) query['location.village'] = new RegExp(village, 'i');
        if (pincode) query['location.pincode'] = pincode;

        // Search filter
        if (search) {
            query.$or = [
                { name: new RegExp(search, 'i') },
                { phone: new RegExp(search, 'i') },
                { email: new RegExp(search, 'i') }
            ];
        }

        const contacts = await Contact.find(query)
            .sort({ createdAt: -1 })
            .limit(1000);

        res.json({
            success: true,
            count: contacts.length,
            data: contacts
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/contacts - Create single contact
 */
router.post('/', async (req, res) => {
    try {
        const contact = await Contact.create({
            ...req.body,
            user: req.user._id
        });

        res.status(201).json({
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

/**
 * POST /api/contacts/import - Import from Excel/CSV
 */
router.post('/import', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        // Read Excel/CSV
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        // Import contacts
        const imported = [];
        const errors = [];

        for (const row of data) {
            try {
                const contact = await Contact.create({
                    user: req.user._id,
                    name: row.name || row.Name,
                    phone: String(row.phone || row.Phone || row.mobile || row.Mobile),
                    email: row.email || row.Email,
                    location: {
                        city: row.city || row.City,
                        village: row.village || row.Village,
                        pincode: row.pincode || row.Pincode,
                        state: row.state || row.State
                    },
                    customFields: row
                });

                imported.push(contact);

            } catch (error) {
                errors.push({
                    row,
                    error: error.message
                });
            }
        }

        // Delete uploaded file
        require('fs').unlinkSync(req.file.path);

        res.json({
            success: true,
            message: `Imported ${imported.length} contacts`,
            imported: imported.length,
            errors: errors.length,
            errorDetails: errors.slice(0, 10) // First 10 errors
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/contacts/export - Export to Excel
 */
router.get('/export', async (req, res) => {
    try {
        const contacts = await Contact.find({ user: req.user._id });

        // Convert to Excel format
        const data = contacts.map(c => ({
            Name: c.name,
            Phone: c.phone,
            Email: c.email,
            City: c.location.city,
            Village: c.location.village,
            Pincode: c.location.pincode,
            State: c.location.state,
            Status: c.lastMessageStatus,
            LastMessage: c.lastMessageDate
        }));

        const ws = xlsx.utils.json_to_sheet(data);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Contacts');

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename=contacts.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/contacts/:id - Delete contact
 */
router.delete('/:id', async (req, res) => {
    try {
        await Contact.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id
        });

        res.json({
            success: true,
            message: 'Contact deleted'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
