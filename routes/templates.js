const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Template = require('../models/Template');

// @route   GET /api/templates
// @desc    Get all templates
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const { category, language } = req.query;
        
        const query = {
            $or: [
                { userId: req.user.id },
                { isPublic: true }
            ]
        };
        
        if (category) query.category = category;
        if (language) query.language = language;

        const templates = await Template.find(query).sort('-createdAt');

        res.json({
            success: true,
            data: templates
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   POST /api/templates
// @desc    Create new template
// @access  Private
router.post('/', protect, async (req, res) => {
    try {
        const templateData = {
            ...req.body,
            userId: req.user.id
        };

        const template = await Template.create(templateData);

        req.user.stats.totalTemplates++;
        await req.user.save();

        res.status(201).json({
            success: true,
            data: template
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   GET /api/templates/:id
// @desc    Get single template
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const template = await Template.findById(req.params.id);

        if (!template) {
            return res.status(404).json({ 
                success: false, 
                error: 'Template not found' 
            });
        }

        res.json({
            success: true,
            data: template
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   PUT /api/templates/:id
// @desc    Update template
// @access  Private
router.put('/:id', protect, async (req, res) => {
    try {
        const template = await Template.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            req.body,
            { new: true, runValidators: true }
        );

        if (!template) {
            return res.status(404).json({ 
                success: false, 
                error: 'Template not found' 
            });
        }

        res.json({
            success: true,
            data: template
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// @route   DELETE /api/templates/:id
// @desc    Delete template
// @access  Private
router.delete('/:id', protect, async (req, res) => {
    try {
        const template = await Template.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!template) {
            return res.status(404).json({ 
                success: false, 
                error: 'Template not found' 
            });
        }

        res.json({
            success: true,
            message: 'Template deleted successfully'
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
