/**
 * ═══════════════════════════════════════════════════════════════
 * WA CLOUD SENDER SEVA - FINAL PRODUCTION v7.0
 * Fixed for Render.com deployment
 * ═══════════════════════════════════════════════════════════════
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Import database
const { connectDB } = require('./config/database');

// Import services
const schedulerService = require('./services/schedulerService');
const folderWatchService = require('./services/folderWatchService');

// CRITICAL: Get PORT from environment (Render provides this)
const PORT = process.env.PORT || 10000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const HOST = '0.0.0.0'; // MUST be 0.0.0.0 for Render

console.log(`🔧 Starting server on ${HOST}:${PORT}`);

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    },
    transports: ['websocket', 'polling']
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, error: 'Too many requests' }
});
app.use('/api/', limiter);

// Socket.IO
io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);
    
    socket.on('join', (userId) => {
        socket.join(`user_${userId}`);
        console.log(`👤 User ${userId} joined room`);
    });
    
    socket.on('disconnect', () => {
        console.log(`🔌 Socket disconnected: ${socket.id}`);
    });

    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
});

app.set('io', io);
global.io = io;

// Import routes
const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaigns');
const contactRoutes = require('./routes/contacts');
const listRoutes = require('./routes/lists');
const whatsappRoutes = require('./routes/whatsapp');
const orderRoutes = require('./routes/orders');

// Health check (CRITICAL for Render)
app.get('/health', (req, res) => {
    const mongoose = require('mongoose');
    res.status(200).json({
        status: 'healthy',
        uptime: Math.floor(process.uptime()),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
        port: PORT,
        env: NODE_ENV
    });
});

// API info
app.get('/api', (req, res) => {
    const mongoose = require('mongoose');
    res.json({
        name: 'WA Cloud Sender Seva API',
        version: '7.0.0',
        status: 'running',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        port: PORT,
        endpoints: {
            auth: '/api/auth',
            campaigns: '/api/campaigns',
            contacts: '/api/contacts',
            lists: '/api/lists',
            whatsapp: '/api/whatsapp',
            orders: '/api/orders',
            health: '/health'
        }
    });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/orders', orderRoutes);

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/create-campaign', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'create-campaign.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.url
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: NODE_ENV === 'development' ? err.message : 'Internal Server Error',
        stack: NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Start server
async function startServer() {
    try {
        console.log('\n' + '═'.repeat(70));
        console.log('🚀 WA CLOUD SENDER SEVA - FINAL PRODUCTION v7.0');
        console.log('═'.repeat(70));

        // Connect to database
        console.log('📦 Connecting to MongoDB...');
        const dbConnected = await connectDB();

        if (dbConnected) {
            console.log('⏰ Initializing scheduler...');
            schedulerService.initializeScheduler(io);

            console.log('👁️  Initializing folder watch...');
            await folderWatchService.initializeFolderWatch(io);
        } else {
            console.log('⚠️  Running in LIMITED MODE (no database)');
        }

        // CRITICAL: Bind to HOST:PORT (must be 0.0.0.0 for Render)
        server.listen(PORT, HOST, () => {
            console.log('\n' + '═'.repeat(70));
            console.log(`📡 Server: http://${HOST}:${PORT}`);
            console.log(`🌐 Environment: ${NODE_ENV}`);
            console.log(`📦 MongoDB: ${dbConnected ? 'Connected ✅' : 'Disconnected ⚠️'}`);
            console.log('═'.repeat(70));
            console.log('\n✨ All Features Active:');
            console.log('   • WhatsApp Bulk Messaging ✅');
            console.log('   • Order Management ✅');
            console.log('   • Folder Watch Auto-Import ✅');
            console.log('   • Real-time Updates ✅');
            console.log('   • Anti-Ban Protection ✅');
            console.log('   • QR Timer Countdown ✅');
            console.log('   • User-Defined Settings ✅');
            console.log('\n📱 Admin: sachinbamniya0143@gmail.com');
            console.log('📞 Phone: +919174406375\n');
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('⚠️  SIGTERM received, shutting down gracefully...');
    const mongoose = require('mongoose');
    schedulerService.stopAllJobs();
    await mongoose.connection.close();
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log('\n⚠️  SIGINT received, shutting down gracefully...');
    const mongoose = require('mongoose');
    schedulerService.stopAllJobs();
    await mongoose.connection.close();
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});

// Start
startServer();

module.exports = { app, server, io };
