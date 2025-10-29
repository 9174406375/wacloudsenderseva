/**
 * ═══════════════════════════════════════════════════════════════
 * WA CLOUD SENDER SEVA - PRODUCTION SERVER v4.0
 * Complete Enterprise WhatsApp Bulk Messaging Platform
 * Admin: Sachin Bamniya <sachinbamniya0143@gmail.com>
 * Phone: +919174406375
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

// Import services
const schedulerService = require('./services/schedulerService');

// Configuration
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api/', limiter);

// Socket.IO middleware
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token) {
        // TODO: Verify JWT token
        next();
    } else {
        next();
    }
});

// Socket.IO connections
io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);
    
    socket.on('join', (userId) => {
        socket.join(`user_${userId}`);
        console.log(`👤 User ${userId} joined room`);
    });
    
    socket.on('disconnect', () => {
        console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
});

// Make io available to routes
app.set('io', io);

// MongoDB connection
mongoose.connect(MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000
})
.then(() => {
    console.log('✅ MongoDB connected successfully');
    
    // Initialize scheduler after DB connection
    schedulerService.initializeScheduler(io);
})
.catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Mongoose error:', err);
});

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
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// API info
app.get('/api', (req, res) => {
    res.json({
        name: 'WA Cloud Sender Seva API',
        version: '4.0.0',
        description: 'Enterprise WhatsApp Bulk Messaging Platform',
        status: 'running',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        endpoints: {
            auth: '/api/auth',
            campaigns: '/api/campaigns',
            contacts: '/api/contacts',
            lists: '/api/lists',
            whatsapp: '/api/whatsapp',
            health: '/health'
        },
        features: [
            'WhatsApp Bulk Messaging (NO QR!)',
            'Anti-ban Random Delays (3-10s)',
            'Percentage-based Daily Sending',
            'Failed Message Retry',
            'Real-time Color-coded Status',
            'Campaign Scheduling',
            'Excel Import/Export',
            'Village/City Targeting',
            'Admin Notifications'
        ],
        admin: {
            email: process.env.ADMIN_EMAIL,
            phone: process.env.ADMIN_PHONE
        }
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

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not Found',
        path: req.url
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: NODE_ENV === 'development' ? err.message : 'Internal Server Error'
    });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '═'.repeat(70));
    console.log('🚀 WA CLOUD SENDER SEVA - PRODUCTION SERVER v4.0');
    console.log('═'.repeat(70));
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log(`🌐 Environment: ${NODE_ENV}`);
    console.log(`📦 MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected ✅' : 'Connecting...'}`);
    console.log('═'.repeat(70));
    console.log('\n✨ All routes registered:');
    console.log('   • /                     - Login Page');
    console.log('   • /dashboard            - Dashboard');
    console.log('   • /api/auth             - Authentication');
    console.log('   • /api/campaigns        - Campaign Management');
    console.log('   • /api/contacts         - Contact Management');
    console.log('   • /api/lists            - Contact Lists');
    console.log('   • /api/whatsapp         - WhatsApp Sessions');
    console.log('   • /health               - Health Check');
    console.log('\n📱 Ready to accept connections!\n');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('⚠️  SIGTERM received, shutting down gracefully...');
    schedulerService.stopAllJobs();
    await mongoose.connection.close();
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

module.exports = { app, server, io };
