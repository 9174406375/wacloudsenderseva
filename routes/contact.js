const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const { protect } = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');

const upload = multer({ dest: 'uploads/' });

// Get all contacts
router.get('/', protect, async (req, res) => {
    try {
        const contacts = await Contact.find({ userId: req.user._id })
            .sort('-createdAt');
        res.json({ success: true, data: contacts });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add single contact
router.post('/', protect, async (req, res) => {
    try {
        const { name, phone, email, tags } = req.body;
        
        const contact = await Contact.create({
            userId: req.user._id,
            name,
            phone,
            email,
            tags
        });
        
        res.status(201).json({ success: true, data: contact });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, error: 'Contact already exists' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// Import from Excel/CSV
router.post('/import', protect, upload.single('file'), async (req, res) => {
    try {
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);
        
        const contacts = data.map(row => ({
            userId: req.user._id,
            name: row.name || row.Name || 'Unknown',
            phone: String(row.phone || row.Phone || row.mobile || row.Mobile),
            email: row.email || row.Email || '',
            tags: []
        }));
        
        const result = await Contact.insertMany(contacts, { ordered: false });
        
        res.json({
            success: true,
            message: `${result.length} contacts imported successfully`,
            data: result
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete contact
router.delete('/:id', protect, async (req, res) => {
    try {
        await Contact.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });
        res.json({ success: true, message: 'Contact deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
