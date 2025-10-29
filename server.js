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

// Initialize Express
const app = express();
const server = http.createServer(app);

// Socket.IO
const io = socketIO(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create directories
['uploads', 'sessions', 'public'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(express.static('public'));

// Request logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ==========================================
// CONNECT DATABASE
// ==========================================
let dbConnected = false;
connectDB()
    .then(() => {
        dbConnected = true;
        console.log('✅ Database ready!');
        
        // Auto-create admin if not exists
        const User = require('./models/User');
        User.findOne({ email: 'sachinbamniya0143@gmail.com' })
            .then(admin => {
                if (!admin) {
                    console.log('📝 Creating admin user...');
                    return User.create({
                        name: 'Sachin Bamniya',
                        email: 'sachinbamniya0143@gmail.com',
                        phone: '+919174406375',
                        password: 'admin@2025',
                        role: 'superadmin',
                        permissions: {
                            canCreateCampaigns: true,
                            canImportContacts: true,
                            canUseTemplates: true,
                            canAccessAnalytics: true,
                            canManageOrders: true,
                            canAccessAdmin: true,
                            maxCampaignsPerDay: 9999,
                            maxContactsPerCampaign: 999999,
                            maxOrdersPerDay: 9999
                        },
                        isActive: true,
                        isVerified: true
                    });
                }
            })
            .then(admin => {
                if (admin) {
                    console.log('✅ Admin user ready!');
                    console.log('📧 Email: sachinbamniya0143@gmail.com');
                    console.log('🔐 Password: admin@2025');
                }
            })
            .catch(err => console.error('Admin creation error:', err));
    })
    .catch(err => {
        console.error('❌ Database connection failed:', err.message);
    });

// Socket.IO
io.on('connection', (socket) => {
    console.log('✅ Socket connected:', socket.id);
    socket.on('disconnect', () => console.log('❌ Socket disconnected:', socket.id));
});

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
        mongodb: dbConnected ? 'connected' : 'disconnected',
        port: PORT
    });
});

app.get('/api', (req, res) => {
    res.json({
        success: true,
        name: 'WA Complete Mega System API',
        version: '11.0.0-FINAL',
        admin: 'sachinbamniya0143@gmail.com',
        adminPassword: 'admin@2025',
        mongodb: dbConnected ? 'connected' : 'disconnected',
        features: [
            '📦 Book Order Management',
            '📱 WhatsApp Integration',
            '📧 Bulk Messaging',
            '📊 Campaign Management',
            '👥 Contact Management',
            '📝 Templates',
            '👨‍💼 Admin Panel',
            '📈 Analytics'
        ],
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                me: 'GET /api/auth/me'
            },
            orders: 'See /api for full docs',
            campaigns: 'See /api for full docs',
            contacts: 'See /api for full docs'
        }
    });
});

// API Routes
try {
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/orders', require('./routes/orders'));
    app.use('/api/campaigns', require('./routes/campaigns'));
    app.use('/api/contacts', require('./routes/contacts'));
    app.use('/api/whatsapp', require('./routes/whatsapp'));
    app.use('/api/templates', require('./routes/templates'));
    app.use('/api/admin', require('./routes/admin'));
    app.use('/api/analytics', require('./routes/analytics'));
    console.log('✅ All routes loaded!');
} catch (error) {
    console.error('❌ Route loading error:', error.message);
}

// ==========================================
// ERROR HANDLING
// ==========================================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.originalUrl,
        availableRoutes: [
            '/api',
            '/health',
            '/api/auth/register',
            '/api/auth/login'
        ]
    });
});

app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
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
    console.log('🚀 WA COMPLETE MEGA SYSTEM - SERVER STARTED');
    console.log('='.repeat(80));
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log(`🌐 Environment: ${NODE_ENV}`);
    console.log(`👤 Admin: sachinbamniya0143@gmail.com`);
    console.log(`🔐 Password: admin@2025`);
    console.log(`📅 Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log('='.repeat(80));
    console.log('✅ Ready to accept requests!\n');
});

process.on('SIGTERM', () => {
    console.log('⚠️  SIGTERM received, closing...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

module.exports = { app, server, io };
