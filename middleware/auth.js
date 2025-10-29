/**
 * ═══════════════════════════════════════════════════════════════
 * AUTHENTICATION MIDDLEWARE - WA Cloud Sender Seva
 * JWT-based authentication with role & permission management
 * Production-ready with comprehensive security checks
 * ═══════════════════════════════════════════════════════════════
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Environment variables with fallback
const JWT_SECRET = process.env.JWT_SECRET || 'wacloudseva-secret-2025-change-in-production';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '30d';

/**
 * ═══════════════════════════════════════════════════════════════
 * PROTECT MIDDLEWARE - JWT Token Verification
 * Usage: router.get('/protected', protect, handler)
 * ═══════════════════════════════════════════════════════════════
 */
exports.protect = async (req, res, next) => {
    try {
        let token;

        // Extract token from Authorization header (Bearer token)
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        // Check if token exists
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Access denied. No token provided. Please login first.'
            });
        }

        try {
            // Verify JWT token
            const decoded = jwt.verify(token, JWT_SECRET);

            // Fetch user from database (exclude password)
            const user = await User.findById(decoded.id).select('-password');

            // Check if user exists
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'User associated with this token no longer exists'
                });
            }

            // Check if user account is active
            if (!user.isActive) {
                return res.status(401).json({
                    success: false,
                    error: 'Your account is inactive. Please contact administrator.',
                    adminEmail: process.env.ADMIN_EMAIL || 'support@wacloud.com'
                });
            }

            // Check if account is locked (failed login attempts)
            if (user.isLocked) {
                const lockUntil = user.security.lockUntil;
                const minutesRemaining = Math.ceil((lockUntil - Date.now()) / 60000);
                
                return res.status(401).json({
                    success: false,
                    error: `Account temporarily locked due to multiple failed login attempts. Try again in ${minutesRemaining} minutes.`
                });
            }

            // Check if password was changed after token was issued
            if (user.passwordChangedAt && user.changedPasswordAfter(decoded.iat)) {
                return res.status(401).json({
                    success: false,
                    error: 'Password was recently changed. Please login again with new password.'
                });
            }

            // Attach user data to request object for use in routes
            req.user = user;
            req.userId = user._id;

            // Update last activity (async, don't wait)
            User.findByIdAndUpdate(user._id, {
                'activity.lastSeen': Date.now()
            }).catch(err => console.error('Error updating last activity:', err));

            // Proceed to next middleware/route handler
            next();

        } catch (err) {
            // JWT verification failed
            if (err.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid token. Please login again.'
                });
            }

            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    error: 'Token has expired. Please login again.'
                });
            }

            // Other JWT errors
            return res.status(401).json({
                success: false,
                error: 'Token verification failed'
            });
        }

    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            error: 'Authentication system error. Please try again.'
        });
    }
};

/**
 * ═══════════════════════════════════════════════════════════════
 * CHECK PERMISSION MIDDLEWARE - Fine-grained access control
 * Usage: router.post('/campaign', protect, checkPermission('bulk_send'), handler)
 * ═══════════════════════════════════════════════════════════════
 */
exports.checkPermission = (...requiredPermissions) => {
    return (req, res, next) => {
        // Ensure user is authenticated first
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required. Please login first.'
            });
        }

        // Superadmin and Admin have all permissions
        if (['superadmin', 'admin'].includes(req.user.role)) {
            return next();
        }

        // Check if user has all required permissions
        const userPermissions = req.user.permissions || [];
        const hasAllPermissions = requiredPermissions.every(permission =>
            userPermissions.includes(permission)
        );

        if (!hasAllPermissions) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions to perform this action',
                required: requiredPermissions,
                current: userPermissions,
                message: 'Please upgrade your subscription or contact administrator'
            });
        }

        next();
    };
};

/**
 * ═══════════════════════════════════════════════════════════════
 * RESTRICT TO ROLES - Role-based access control
 * Usage: router.get('/admin', protect, restrictTo('admin', 'superadmin'), handler)
 * ═══════════════════════════════════════════════════════════════
 */
exports.restrictTo = (...allowedRoles) => {
    return (req, res, next) => {
        // Ensure user is authenticated
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        // Check if user's role is in allowed roles
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. This action is restricted to specific roles.',
                allowedRoles: allowedRoles,
                yourRole: req.user.role
            });
        }

        next();
    };
};

/**
 * ═══════════════════════════════════════════════════════════════
 * GENERATE JWT TOKEN - Utility function
 * Usage: const token = generateToken(user._id)
 * ═══════════════════════════════════════════════════════════════
 */
exports.generateToken = (userId) => {
    return jwt.sign(
        { id: userId },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRE }
    );
};

/**
 * ═══════════════════════════════════════════════════════════════
 * VERIFY TOKEN - Utility function (without database lookup)
 * Usage: const decoded = verifyToken(token)
 * ═══════════════════════════════════════════════════════════════
 */
exports.verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};

/**
 * ═══════════════════════════════════════════════════════════════
 * OPTIONAL AUTH - For routes that work with or without auth
 * Usage: router.get('/public', optionalAuth, handler)
 * ═══════════════════════════════════════════════════════════════
 */
exports.optionalAuth = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                const user = await User.findById(decoded.id).select('-password');
                
                if (user && user.isActive) {
                    req.user = user;
                    req.userId = user._id;
                }
            } catch (err) {
                // Invalid token, but route is optional, so continue
                console.log('Optional auth: Invalid token provided');
            }
        }

        next();
    } catch (error) {
        console.error('Optional auth error:', error);
        next();
    }
};

module.exports = exports;
