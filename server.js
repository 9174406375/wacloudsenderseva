/**
 * ═══════════════════════════════════════════════════════════════
 * WA CLOUD SENDER SEVA - PRODUCTION SERVER v5.0
 * Complete WhatsApp Bulk Messaging Platform
 * Enhanced with Error Handling & Retry Logic
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

// Configuration
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests'
});
app.use('/api/', limiter);

// Socket.IO
io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);
    
    socket.on('join', (userId) => {
        socket.join(`user_${userId}`);
    });
    
    socket.on('disconnect', () => {
        console.log(`🔌 Disconnected: ${socket.id}`);
    });
});

app.set('io', io);

// Import routes
const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaigns');
const contactRoutes = require('./routes/contacts');
const listRoutes = require('./routes/lists');
const whatsappRoutes = require('./routes/whatsapp');

// Health check
app.get('/health', (req, res) => {
    const mongoose = require('mongoose');
    res.json({
        status: 'healthy',
        uptime: Math.floor(process.uptime()),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// API info
app.get('/api', (req, res) => {
    const mongoose = require('mongoose');
    res.json({
        name: 'WA Cloud Sender Seva API',
        version: '5.0.0',
        status: 'running',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        endpoints: {
            auth: '/api/auth',
            campaigns: '/api/campaigns',
            contacts: '/api/contacts',
            lists: '/api/lists',
            whatsapp: '/api/whatsapp'
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
        error: 'Not Found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(err.status || 500).json({
        success: false,
        error: NODE_ENV === 'development' ? err.message : 'Server Error'
    });
});

// Start server
async function startServer() {
    try {
        console.log('\n' + '═'.repeat(70));
        console.log('🚀 WA CLOUD SENDER SEVA - PRODUCTION SERVER v5.0');
        console.log('═'.repeat(70));

        // Connect to database
        const dbConnected = await connectDB();

        // Start scheduler if DB connected
        if (dbConnected) {
            const schedulerService = require('./services/schedulerService');
            schedulerService.initializeScheduler(io);
        }

        // Start HTTP server
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`\n📡 Server: http://localhost:${PORT}`);
            console.log(`🌐 Environment: ${NODE_ENV}`);
            console.log(`📦 MongoDB: ${dbConnected ? 'Connected ✅' : 'Disconnected ⚠️'}`);
            console.log('═'.repeat(70));
            console.log('\n✨ Routes: /api/auth, /api/campaigns, /api/contacts');
            console.log('📱 Ready!\n');
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    const mongoose = require('mongoose');
    await mongoose.connection.close();
    server.close(() => process.exit(0));
});

// Start
startServer();

module.exports = { app, server, io };
