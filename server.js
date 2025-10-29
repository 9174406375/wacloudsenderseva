require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const fs = require('fs');
const { connectDB } = require('./config/database');
const schedulerService = require('./services/schedulerService');

// Initialize Express
const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = socketIO(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Environment variables
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create required directories
const dirs = ['uploads', 'sessions', 'public'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Request logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ==========================================
// DATABASE CONNECTION
// ==========================================
connectDB();

// ==========================================
// SOCKET.IO EVENTS
// ==========================================
io.on('connection', (socket) => {
    console.log('✅ Socket client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('❌ Socket client disconnected:', socket.id);
    });

    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
});

// Make io accessible to routes
app.set('io', io);

// ==========================================
// ROUTES
// ==========================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        mongodb: require('mongoose').connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

app.get('/api', (req, res) => {
    res.json({
        success: true,
        name: 'WA Complete Mega System API',
        version: '11.0.0-FINAL',
        description: 'Complete WhatsApp Order Bot + Bulk Sender + Admin Panel',
        admin: 'sachinbamniya0143@gmail.com',
        features: [
            '📦 Book Order Management System',
            '📱 WhatsApp Integration (Baileys v6.7.8)',
            '🔐 Pairing Code + QR Code Support',
            '📧 Bulk Messaging with Anti-ban',
            '📊 Campaign Scheduling & Management',
            '👥 Contact Management with Excel/CSV Import',
            '📍 Pincode-based Filtering',
            '📝 Message Templates',
            '👨‍💼 Admin Panel & User Management',
            '📈 Advanced Analytics & Reports',
            '⏰ Cron Job Scheduler',
            '🔄 Real-time Updates (Socket.IO)',
            '🛡️  Security with JWT & Helmet',
            '💾 MongoDB Database'
        ],
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                me: 'GET /api/auth/me'
            },
            orders: {
                create: 'POST /api/orders',
                getAll: 'GET /api/orders',
                getOne: 'GET /api/orders/:id',
                updateStatus: 'PUT /api/orders/:id/status',
                stats: 'GET /api/orders/analytics/stats',
                byPincode: 'GET /api/orders/pincode/:pincode'
            },
            campaigns: {
                create: 'POST /api/campaigns',
                getAll: 'GET /api/campaigns',
                getOne: 'GET /api/campaigns/:id',
                update: 'PUT /api/campaigns/:id',
                delete: 'DELETE /api/campaigns/:id',
                start: 'POST /api/campaigns/:id/start'
            },
            contacts: {
                getAll: 'GET /api/contacts',
                create: 'POST /api/contacts',
                import: 'POST /api/contacts/import',
                getOne: 'GET /api/contacts/:id',
                update: 'PUT /api/contacts/:id',
                delete: 'DELETE /api/contacts/:id',
                stats: 'GET /api/contacts/analytics/overview'
            },
            whatsapp: {
                connect: 'POST /api/whatsapp/connect',
                status: 'GET /api/whatsapp/status',
                disconnect: 'POST /api/whatsapp/disconnect',
                send: 'POST /api/whatsapp/send'
            },
            templates: {
                getAll: 'GET /api/templates',
                create: 'POST /api/templates',
                getOne: 'GET /api/templates/:id',
                update: 'PUT /api/templates/:id',
                delete: 'DELETE /api/templates/:id'
            },
            admin: {
                users: 'GET /api/admin/users',
                permissions: 'PUT /api/admin/users/:id/permissions',
                dashboard: 'GET /api/admin/dashboard'
            },
            analytics: {
                overview: 'GET /api/analytics/overview',
                orders: 'GET /api/analytics/orders',
                campaigns: 'GET /api/analytics/campaigns'
            }
        }
    });
});

// Mount API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/analytics', require('./routes/analytics'));

// ==========================================
// ERROR HANDLING
// ==========================================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.originalUrl
    });
});

app.use((err, req, res, next) => {
    console.error('❌ Error:', err.stack);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal Server Error',
        ...(NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ==========================================
// START SERVER
// ==========================================
server.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 WA COMPLETE MEGA SYSTEM - PRODUCTION SERVER STARTED');
    console.log('='.repeat(80));
    console.log(`📡 Server URL: http://localhost:${PORT}`);
    console.log(`🌐 Environment: ${NODE_ENV}`);
    console.log(`👤 Admin: sachinbamniya0143@gmail.com`);
    console.log(`📅 Started: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log(`⚡ Node Version: ${process.version}`);
    console.log('='.repeat(80));
    console.log('\n✅ All systems ready!');
    console.log('📦 Features: Orders + Campaigns + Contacts + WhatsApp + Templates + Admin');
    console.log('🔐 Security: JWT + Helmet + Rate Limiting');
    console.log('📊 Database: MongoDB Connected');
    console.log('⏰ Schedulers: Active\n');
    
    // Start schedulers
    schedulerService.startAll(io);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('⚠️  SIGTERM signal received, closing server gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        schedulerService.stopAll();
        process.exit(0);
    });
});

module.exports = { app, server, io };
