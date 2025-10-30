require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback'
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const User = require('./models/User');
            let user = await User.findOne({ googleId: profile.id });
            
            if (!user) {
                user = await User.create({
                    name: profile.displayName,
                    email: profile.emails[0].value,
                    googleId: profile.id,
                    avatar: profile.photos[0]?.value
                });
            }
            
            return done(null, user);
        } catch (error) {
            return done(error, null);
        }
    }));
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const User = require('./models/User');
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// MongoDB Connection (Mongoose 8.x compatible)
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ MongoDB Connected Successfully!');
        console.log('📊 Database:', mongoose.connection.name);
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
        process.exit(1);
    });

// Routes
const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contacts');
const campaignRoutes = require('./routes/campaigns');
const orderRoutes = require('./routes/orders');
const whatsappRoutes = require('./routes/whatsapp');
const analyticsRoutes = require('./routes/analytics');
const adminRoutes = require('./routes/admin');

app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);

// Health Check
app.get('/health', async (req, res) => {
    const healthData = {
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        database: mongoose.connection.name,
        environment: process.env.NODE_ENV,
        adminNumber: process.env.ADMIN_NUMBER,
        features: {
            bookOrders: process.env.ENABLE_BOOK_ORDERS === 'true',
            bulkSender: process.env.ENABLE_BULK_SENDER === 'true',
            autoRetry: process.env.ENABLE_AUTO_RETRY === 'true'
        }
    };
    res.json(healthData);
});

// Home
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🚀 WA Cloud Sender Seva API v3.1.0',
        version: '3.1.0',
        description: 'Complete WhatsApp Bulk Sender + Book Order System',
        admin: {
            email: process.env.ADMIN_EMAIL,
            number: process.env.ADMIN_NUMBER
        },
        features: [
            '✅ Google OAuth Login',
            '✅ WhatsApp Bulk Messaging',
            '✅ Contact Management (CSV/Excel)',
            '✅ Campaign System with Anti-Ban',
            '✅ Book Order Management',
            '✅ Analytics & Reports',
            '✅ Admin Panel',
            '✅ Real-time Notifications'
        ],
        endpoints: [
            '/api/auth - Authentication',
            '/api/whatsapp - WhatsApp Operations',
            '/api/campaigns - Campaign Management',
            '/api/contacts - Contact Management',
            '/api/orders - Order Management',
            '/api/analytics - Analytics & Reports',
            '/api/admin - Admin Panel'
        ],
        documentation: process.env.CLIENT_URL + '/docs'
    });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        availableEndpoints: [
            '/api/auth',
            '/api/contacts',
            '/api/campaigns',
            '/api/orders',
            '/api/whatsapp',
            '/api/analytics',
            '/api/admin'
        ]
    });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log('============================================================');
    console.log('🚀 WA CLOUD SENDER SEVA - SERVER STARTED');
    console.log('============================================================');
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Port: ${PORT}`);
    console.log(`🔗 URL: ${process.env.CLIENT_URL || 'http://localhost:' + PORT}`);
    console.log(`👤 Admin: ${process.env.ADMIN_EMAIL}`);
    console.log(`📱 Admin Number: ${process.env.ADMIN_NUMBER}`);
    console.log('============================================================');
    console.log('📋 Available Routes:');
    console.log('   /api/auth       - Authentication');
    console.log('   /api/whatsapp   - WhatsApp Operations');
    console.log('   /api/campaigns  - Campaign Management');
    console.log('   /api/contacts   - Contact Management');
    console.log('   /api/orders     - Order Management');
    console.log('   /api/analytics  - Analytics & Reports');
    console.log('   /api/admin      - Admin Panel');
    console.log('============================================================');
});

// Graceful Shutdown (Mongoose 8.x compatible - async/await)
process.on('SIGTERM', async () => {
    console.log('⚠️ SIGTERM received. Shutting down gracefully...');
    try {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed.');
        server.close(() => {
            console.log('✅ HTTP server closed.');
            process.exit(0);
        });
    } catch (err) {
        console.error('❌ Error during shutdown:', err);
        process.exit(1);
    }
});

process.on('SIGINT', async () => {
    console.log('⚠️ SIGINT received. Shutting down gracefully...');
    try {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed.');
        server.close(() => {
            console.log('✅ HTTP server closed.');
            process.exit(0);
        });
    } catch (err) {
        console.error('❌ Error during shutdown:', err);
        process.exit(1);
    }
});

module.exports = app;
