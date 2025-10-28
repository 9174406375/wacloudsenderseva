const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const config = require('./config');
const db = require('./database');
const routes = require('./routes');
const whatsappClient = require('./whatsapp');
const bulkSender = require('./bulk-sender');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// API Routes
app.use(routes);

// Serve HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ==================== WEBSOCKET EVENTS ====================

io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    // Send current WhatsApp status on connection
    socket.emit('whatsapp_status', whatsappClient.getStatus());

    // Send daily stats
    socket.emit('daily_stats', bulkSender.getDailyStats());

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });
});

// ==================== WHATSAPP EVENT LISTENERS ====================

// QR Code Event
whatsappClient.on('qr_code', (data) => {
    console.log('📱 Broadcasting QR code to clients');
    io.emit('notification', {
        type: 'info',
        title: 'QR Code Ready',
        message: data.message,
        timestamp: data.timestamp
    });
    io.emit('whatsapp_qr', {
        qr: data.qr,
        timestamp: data.timestamp
    });
});

// Pairing Code Event
whatsappClient.on('pairing_code', (data) => {
    console.log('🔐 Broadcasting pairing code to clients');
    io.emit('notification', {
        type: 'info',
        title: 'Pairing Code Ready',
        message: data.message,
        code: data.code,
        timestamp: data.timestamp
    });
    io.emit('whatsapp_pairing_code', {
        code: data.code,
        timestamp: data.timestamp
    });
});

// Connected Event
whatsappClient.on('connected', (data) => {
    console.log('✅ Broadcasting connection success to clients');
    io.emit('notification', {
        type: 'success',
        title: 'WhatsApp Connected',
        message: data.message,
        number: data.number,
        name: data.name,
        timestamp: data.timestamp
    });
    io.emit('whatsapp_connected', {
        number: data.number,
        name: data.name,
        timestamp: data.timestamp
    });
    io.emit('whatsapp_status', whatsappClient.getStatus());
});

// Authenticated Event
whatsappClient.on('authenticated', (data) => {
    console.log('🔐 Broadcasting authentication to clients');
    io.emit('notification', {
        type: 'success',
        title: 'Authenticated',
        message: data.message,
        timestamp: data.timestamp
    });
});

// Authentication Failed Event
whatsappClient.on('auth_failure', (data) => {
    console.error('❌ Broadcasting auth failure to clients');
    io.emit('notification', {
        type: 'error',
        title: 'Authentication Failed',
        message: data.message,
        timestamp: data.timestamp
    });
    io.emit('whatsapp_status', whatsappClient.getStatus());
});

// Disconnected Event
whatsappClient.on('disconnected', (data) => {
    console.log('🔌 Broadcasting disconnection to clients');
    io.emit('notification', {
        type: 'warning',
        title: 'WhatsApp Disconnected',
        message: data.message,
        reason: data.reason,
        timestamp: data.timestamp
    });
    io.emit('whatsapp_disconnected', {
        reason: data.reason,
        previousNumber: data.previousNumber,
        timestamp: data.timestamp
    });
    io.emit('whatsapp_status', whatsappClient.getStatus());
});

// Logged Out Event
whatsappClient.on('logged_out', (data) => {
    console.log('🔓 Broadcasting logout to clients');
    io.emit('notification', {
        type: 'info',
        title: 'Logged Out',
        message: data.message,
        number: data.number,
        timestamp: data.timestamp
    });
    io.emit('whatsapp_logged_out', {
        number: data.number,
        timestamp: data.timestamp
    });
    io.emit('whatsapp_status', whatsappClient.getStatus());
});

// Loading Event
whatsappClient.on('loading', (data) => {
    io.emit('whatsapp_loading', {
        percent: data.percent,
        message: data.message
    });
});

// ==================== BULK SENDER EVENT LISTENERS ====================

// Campaign Started Event
bulkSender.on('campaign_started', (data) => {
    console.log('🚀 Campaign started:', data.name);
    io.emit('notification', {
        type: 'success',
        title: 'Campaign Started',
        message: `Campaign "${data.name}" started with ${data.totalRecipients} recipients`,
        campaignId: data.campaignId
    });
    io.emit('campaign_started', data);
});

// Campaign Progress Event
bulkSender.on('progress', (data) => {
    io.emit('campaign_progress', data);
    
    // Send notification every 10%
    if (data.percentage % 10 === 0) {
        io.emit('notification', {
            type: 'info',
            title: 'Campaign Progress',
            message: `${data.percentage}% complete - Sent: ${data.sentCount}/${data.totalRecipients}`,
            campaignId: data.campaignId
        });
    }
});

// Campaign Completed Event
bulkSender.on('campaign_completed', (data) => {
    console.log('✅ Campaign completed:', data.name);
    io.emit('notification', {
        type: 'success',
        title: 'Campaign Completed',
        message: `Campaign "${data.name}" completed! Sent: ${data.sentCount}, Failed: ${data.failedCount}`,
        campaignId: data.campaignId
    });
    io.emit('campaign_completed', data);
    io.emit('daily_stats', bulkSender.getDailyStats());
});

// Campaign Paused Event
bulkSender.on('campaign_paused', (data) => {
    console.log('⏸️ Campaign paused');
    io.emit('notification', {
        type: 'warning',
        title: 'Campaign Paused',
        message: 'Campaign has been paused',
        campaignId: data.campaignId
    });
    io.emit('campaign_paused', data);
});

// Campaign Resumed Event
bulkSender.on('campaign_resumed', (data) => {
    console.log('▶️ Campaign resumed');
    io.emit('notification', {
        type: 'success',
        title: 'Campaign Resumed',
        message: 'Campaign has been resumed',
        campaignId: data.campaignId
    });
    io.emit('campaign_resumed', data);
});

// Campaign Stopped Event
bulkSender.on('campaign_stopped', (data) => {
    console.log('⏹️ Campaign stopped');
    io.emit('notification', {
        type: 'warning',
        title: 'Campaign Stopped',
        message: 'Campaign has been stopped',
        campaignId: data.campaignId
    });
    io.emit('campaign_stopped', data);
});

// Daily Limit Reached Event
bulkSender.on('daily_limit_reached', (data) => {
    console.log('⚠️ Daily limit reached');
    io.emit('notification', {
        type: 'warning',
        title: 'Daily Limit Reached',
        message: 'Daily message limit has been reached. Campaign paused.',
        campaignId: data.campaignId
    });
    io.emit('daily_stats', bulkSender.getDailyStats());
});

// ==================== ERROR HANDLING ====================

// 404 Error Handler
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// ==================== SERVER START ====================

const PORT = process.env.PORT || config.PORT || 3000;

server.listen(PORT, '0.0.0.0', async () => {
    console.log('
');
    console.log('='.repeat(60));
    console.log('🚀 WhatsApp Bulk Sender System Started!');
    console.log('='.repeat(60));
    console.log(`📡 Server running on: http://localhost:${PORT}`);
    console.log(`🌐 Network access: http://0.0.0.0:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`👨‍💼 Admin Panel: http://localhost:${PORT}/admin`);
    console.log('='.repeat(60));
    console.log('
');

    // Initialize database
    try {
        await db.initialize();
        console.log('✅ Database initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
    }

    console.log('
📱 Waiting for WhatsApp connection...');
    console.log('💡 Tip: Open http://localhost:' + PORT + ' in browser
');
});

// Graceful Shutdown
process.on('SIGINT', async () => {
    console.log('

🛑 Shutting down gracefully...');
    
    try {
        // Logout from WhatsApp
        if (whatsappClient.isReady) {
            await whatsappClient.logout();
            console.log('✅ WhatsApp logged out');
        }

        // Close database
        await db.close();
        console.log('✅ Database closed');

        // Close server
        server.close(() => {
            console.log('✅ Server closed');
            process.exit(0);
        });
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Rejection:', error);
    process.exit(1);
});

module.exports = { app, server, io };
