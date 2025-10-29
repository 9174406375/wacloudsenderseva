require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { connectDB } = require('./config/database');
const { startScheduler } = require('./services/scheduler');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
connectDB();

// Socket.IO Connection
io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);
    });
});

// Health Check (Railway anti-sleep)
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: Math.floor(process.uptime()),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// Root Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Info
app.get('/api', (req, res) => {
    res.json({
        name: 'WA Cloud Sender Seva API',
        version: '9.0.0',
        status: 'running',
        admin: 'sachinbamniya0143@gmail.com',
        features: [
            'User Authentication (JWT)',
            'Campaign Management',
            'Contact Management',
            'CSV/Excel Import',
            'Scheduled Campaigns',
            'Real-time Updates (Socket.IO)',
            'MongoDB Integration',
            'Anti-ban Protection'
        ],
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login'
            },
            campaigns: {
                create: 'POST /api/campaigns',
                getAll: 'GET /api/campaigns',
                getOne: 'GET /api/campaigns/:id',
                delete: 'DELETE /api/campaigns/:id'
            },
            contacts: {
                getAll: 'GET /api/contacts',
                create: 'POST /api/contacts',
                import: 'POST /api/contacts/import',
                delete: 'DELETE /api/contacts/:id'
            }
        }
    });
});

// Import Routes
const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaign');
const contactRoutes = require('./routes/contact');

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/contacts', contactRoutes);

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.url
    });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal Server Error'
    });
});

// Start Scheduler
startScheduler(io);

// Start Server
server.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 WA CLOUD SENDER SEVA - Production Server');
    console.log('='.repeat(70));
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`👤 Admin: sachinbamniya0143@gmail.com`);
    console.log(`⏰ Started: ${new Date().toLocaleString('en-IN')}`);
    console.log('='.repeat(70) + '\n');
});

// Graceful Shutdown
process.on('SIGTERM', () => {
    console.log('⚠️  SIGTERM received, closing server...');
    server.close(() => {
        mongoose.connection.close();
        process.exit(0);
    });
});

module.exports = { app, server, io };
