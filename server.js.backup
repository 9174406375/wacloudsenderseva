require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const app = express();

// ==================== MIDDLEWARE ====================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// CORS Configuration
app.use(cors({
    origin: [
        process.env.CLIENT_URL,
        'http://localhost:3000',
        'http://localhost:5000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Passport Configuration
require('./config/passport');
app.use(passport.initialize());
app.use(passport.session());

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// ==================== DATABASE CONNECTION ====================
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ MongoDB Connected Successfully!');
        console.log(`📊 Database: ${mongoose.connection.name}`);
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
        console.error('💡 Check:');
        console.error('   1. MongoDB Atlas cluster running?');
        console.error('   2. Network access (0.0.0.0/0) configured?');
        console.error('   3. Correct username/password in .env?');
    });

// ==================== ROUTES ====================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/admin', require('./routes/admin'));

// ==================== HOME ROUTE ====================
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🚀 WA Cloud Sender Seva API',
        version: '3.0.0',
        status: 'running',
        deployment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        features: [
            '✅ Google OAuth Login',
            '✅ WhatsApp Bulk Sender with Anti-Ban',
            '✅ Book Order Management System',
            '✅ Campaign Management',
            '✅ Contact Management',
            '✅ Template System',
            '✅ Analytics Dashboard',
            '✅ Admin Panel'
        ],
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                googleOAuth: 'GET /api/auth/google',
                profile: 'GET /api/auth/me',
                logout: 'POST /api/auth/logout',
                forgotPassword: 'POST /api/auth/forgotpassword',
                resetPassword: 'PUT /api/auth/resetpassword/:token'
            },
            whatsapp: {
                connect: 'POST /api/whatsapp/connect',
                status: 'GET /api/whatsapp/status',
                sendMessage: 'POST /api/whatsapp/send',
                bulkSend: 'POST /api/whatsapp/bulk',
                retry: 'POST /api/whatsapp/retry',
                disconnect: 'POST /api/whatsapp/disconnect'
            },
            campaigns: {
                list: 'GET /api/campaigns',
                create: 'POST /api/campaigns',
                details: 'GET /api/campaigns/:id',
                update: 'PUT /api/campaigns/:id',
                delete: 'DELETE /api/campaigns/:id'
            },
            contacts: {
                list: 'GET /api/contacts',
                create: 'POST /api/contacts',
                import: 'POST /api/contacts/import',
                export: 'GET /api/contacts/export'
            },
            orders: {
                list: 'GET /api/orders',
                create: 'POST /api/orders',
                details: 'GET /api/orders/:id',
                update: 'PUT /api/orders/:id'
            },
            analytics: {
                dashboard: 'GET /api/analytics/dashboard',
                campaigns: 'GET /api/analytics/campaigns',
                messages: 'GET /api/analytics/messages'
            }
        },
        documentation: 'https://github.com/yourusername/wacloudsenderseva#readme',
        support: process.env.ADMIN_EMAIL
    });
});

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        memory: process.memoryUsage()
    });
});

// ==================== ERROR HANDLING ====================
// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
        path: req.path,
        method: req.method
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🚀 WA CLOUD SENDER SEVA - SERVER STARTED');
    console.log('='.repeat(60));
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Port: ${PORT}`);
    console.log(`🔗 URL: ${process.env.CLIENT_URL || 'http://localhost:' + PORT}`);
    console.log(`👤 Admin: ${process.env.ADMIN_EMAIL}`);
    console.log(`📱 Admin Number: ${process.env.ADMIN_NUMBER}`);
    console.log('='.repeat(60));
    console.log('📋 Available Routes:');
    console.log('   /api/auth       - Authentication');
    console.log('   /api/whatsapp   - WhatsApp Operations');
    console.log('   /api/campaigns  - Campaign Management');
    console.log('   /api/contacts   - Contact Management');
    console.log('   /api/orders     - Order Management');
    console.log('   /api/analytics  - Analytics & Reports');
    console.log('   /api/admin      - Admin Panel');
    console.log('='.repeat(60));
});

// Graceful Shutdown
process.on('SIGTERM', () => {
    console.log('⚠️ SIGTERM received. Shutting down gracefully...');
    mongoose.connection.close(() => {
        console.log('✅ MongoDB connection closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n⚠️ SIGINT received. Shutting down gracefully...');
    mongoose.connection.close(() => {
        console.log('✅ MongoDB connection closed');
        process.exit(0);
    });
});
