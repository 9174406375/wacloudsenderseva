/**
 * ═══════════════════════════════════════════════════════════════
 * CONTACT LISTS ROUTES
 * ═══════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const ContactList = require('../models/ContactList');
const { protect } = require('../middleware/auth');

router.use(protect);

/**
 * GET /api/lists - Get all contact lists
 */
router.get('/', async (req, res) => {
    try {
        const lists = await ContactList.find({ user: req.user._id })
            .populate('contacts')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: lists
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/lists - Create new list
 */
router.post('/', async (req, res) => {
    try {
        const { name, description, contacts, tags } = req.body;

        const list = await ContactList.create({
            user: req.user._id,
            name,
            description,
            contacts: contacts || [],
            tags: tags || []
        });

        res.status(201).json({
            success: true,
            data: list
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/lists/:id - Update list
 */
router.put('/:id', async (req, res) => {
    try {
        const { name, description, contacts, tags } = req.body;

        const list = await ContactList.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { name, description, contacts, tags, updatedAt: Date.now() },
            { new: true }
        );

        res.json({
            success: true,
            data: list
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/lists/:id - Delete list
 */
router.delete('/:id', async (req, res) => {
    try {
        await ContactList.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id
        });

        res.json({
            success: true,
            message: 'List deleted'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
