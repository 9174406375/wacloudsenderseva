/**
 * ═══════════════════════════════════════════════════════════════
 * WA CLOUD SENDER SEVA - PRODUCTION SERVER v3.0
 * Complete WhatsApp Bulk Messaging Platform
 * ═══════════════════════════════════════════════════════════════
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const rateLimit = require('express-rate-limit');

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// ═══════════════════════════════════════════════════════════════
// INITIALIZE APP
// ═══════════════════════════════════════════════════════════════
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: CORS_ORIGIN,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
});

// ═══════════════════════════════════════════════════════════════
// SECURITY MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

// Helmet for security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS
app.use(cors({
    origin: CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // 5 login attempts per 15 minutes
    skipSuccessfulRequests: true
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ═══════════════════════════════════════════════════════════════
// GENERAL MIDDLEWARE
// ═══════════════════════════════════════════════════════════════
app.use(compression()); // Compress all responses
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging
if (NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Request ID middleware
app.use((req, res, next) => {
    req.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    next();
});

// ═══════════════════════════════════════════════════════════════
// MONGODB CONNECTION
// ═══════════════════════════════════════════════════════════════
const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4
        });
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        // Continue without DB for now
    }
};

connectDB();

// MongoDB event handlers
mongoose.connection.on('connected', () => {
    console.log('📊 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️  Mongoose disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
});

// ═══════════════════════════════════════════════════════════════
// SOCKET.IO CONFIGURATION
// ═══════════════════════════════════════════════════════════════
io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Join user-specific room
    socket.on('join', (userId) => {
        socket.join(`user_${userId}`);
        console.log(`User ${userId} joined room`);
    });

    // WhatsApp QR code generation
    socket.on('whatsapp:request_qr', (data) => {
        console.log('QR requested:', data);
        // TODO: Trigger WhatsApp QR generation
        io.to(`user_${data.userId}`).emit('whatsapp:qr', {
            sessionId: data.sessionId,
            qr: 'SAMPLE_QR_CODE'
        });
    });

    // WhatsApp session events
    socket.on('whatsapp:ready', (data) => {
        io.to(`user_${data.userId}`).emit('whatsapp:connected', data);
    });

    socket.on('whatsapp:disconnected', (data) => {
        io.to(`user_${data.userId}`).emit('whatsapp:disconnected', data);
    });

    // Campaign progress updates
    socket.on('campaign:start', (data) => {
        console.log('Campaign started:', data.campaignId);
        // TODO: Start campaign execution
    });

    socket.on('campaign:progress', (data) => {
        io.to(`user_${data.userId}`).emit('campaign:progress', data);
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
});

// Make io available globally
app.set('io', io);

// ═══════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════

// Import routes
const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaigns');
const contactRoutes = require('./routes/contacts');
const listRoutes = require('./routes/lists');
const whatsappRoutes = require('./routes/whatsapp');

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        memory: {
            used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
            total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
            rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`
        },
        version: '3.0.0'
    });
});

// API info
app.get('/api', (req, res) => {
    res.json({
        name: 'WA Cloud Sender Seva API',
        version: '3.0.0',
        description: 'Enterprise WhatsApp Bulk Messaging Platform',
        status: 'running',
        endpoints: {
            auth: '/api/auth',
            campaigns: '/api/campaigns',
            contacts: '/api/contacts',
            lists: '/api/lists',
            whatsapp: '/api/whatsapp',
            health: '/health',
            docs: '/api/docs'
        },
        features: [
            'User Authentication & Authorization',
            'Campaign Management',
            'Contact Management (Excel Import/Export)',
            'Contact Lists',
            'WhatsApp Session Management',
            'Real-time Updates (Socket.IO)',
            'Analytics & Reporting'
        ],
        documentation: 'Coming soon'
    });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ═══════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════

// 404 handler
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.url}`,
        path: req.url,
        timestamp: new Date().toISOString()
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Server error:', {
        message: err.message,
        stack: NODE_ENV === 'development' ? err.stack : undefined,
        requestId: req.id
    });

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            messages,
            requestId: req.id
        });
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(400).json({
            success: false,
            error: 'Duplicate Error',
            message: `${field} already exists`,
            requestId: req.id
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            error: 'Invalid token',
            requestId: req.id
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            error: 'Token expired',
            requestId: req.id
        });
    }

    // Multer file upload errors
    if (err.name === 'MulterError') {
        return res.status(400).json({
            success: false,
            error: 'File upload error',
            message: err.message,
            requestId: req.id
        });
    }

    // Default error
    res.status(err.status || 500).json({
        success: false,
        error: err.status === 500 ? 'Internal Server Error' : err.name,
        message: NODE_ENV === 'development' ? err.message : 'Something went wrong',
        requestId: req.id
    });
});

// ═══════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════
server.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '═'.repeat(70));
    console.log('🚀 WA CLOUD SENDER SEVA - PRODUCTION SERVER v3.0');
    console.log('═'.repeat(70));
    console.log(`📡 Server running on port: ${PORT}`);
    console.log(`🌐 Environment: ${NODE_ENV}`);
    console.log(`🔗 Local URL: http://localhost:${PORT}`);
    console.log(`📊 Health Check: http://localhost:${PORT}/health`);
    console.log(`📚 API Docs: http://localhost:${PORT}/api`);
    console.log(`🔌 Socket.IO: Active`);
    console.log(`📦 MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected ✅' : 'Connecting...'}`);
    console.log('═'.repeat(70));
    console.log('\n✨ All routes registered:');
    console.log('   • /api/auth         - Authentication');
    console.log('   • /api/campaigns    - Campaign Management');
    console.log('   • /api/contacts     - Contact Management');
    console.log('   • /api/lists        - Contact Lists');
    console.log('   • /api/whatsapp     - WhatsApp Sessions');
    console.log('\n📱 Ready to accept connections!\n');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Promise Rejection:', err);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

module.exports = { app, server, io };
