const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - JWT verification
exports.protect = async (req, res, next) => {
    let token;
    
    // Check for token in headers or cookies
    if (req.headers.authorization?.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
        token = req.cookies.token;
    }
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Please login to access this resource'
        });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');
        
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }
        
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
};

// Admin authorization
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        next();
    };
};

module.exports = exports;
