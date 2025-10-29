const express = require('express');
const router = express.Router();

// Temporary in-memory users (for now)
const users = [];

// Register
router.post('/register', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        
        // Check if user exists
        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'User already exists'
            });
        }
        
        // Create user
        const user = {
            id: users.length + 1,
            name,
            email,
            phone,
            password, // In production, hash this!
            createdAt: new Date()
        };
        
        users.push(user);
        
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user
        const user = users.find(u => u.email === email && u.password === password);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }
        
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone
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
