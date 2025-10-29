const express = require('express');
const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Import routes
const authRoutes = require('./routes/auth');

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        uptime: process.uptime(),
        port: PORT,
        timestamp: new Date().toISOString()
    });
});

// Root route
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>WA Cloud Sender Seva</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
        }
        .container {
            text-align: center;
            padding: 40px;
            background: rgba(255,255,255,0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            max-width: 800px;
        }
        h1 { font-size: 48px; margin-bottom: 20px; }
        p { font-size: 20px; margin: 10px 0; }
        .status { 
            background: #10b981; 
            padding: 10px 20px; 
            border-radius: 10px;
            display: inline-block;
            margin: 20px 0;
        }
        .btn {
            color: white;
            text-decoration: none;
            background: #3b82f6;
            padding: 15px 30px;
            border-radius: 10px;
            display: inline-block;
            margin: 10px;
        }
        .feature {
            background: rgba(255,255,255,0.2);
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            text-align: left;
        }
        .feature-list {
            list-style: none;
            padding: 0;
        }
        .feature-list li {
            padding: 5px 0;
        }
        .feature-list li::before {
            content: "✅ ";
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 WA Cloud Sender Seva</h1>
        <div class="status">✅ Server Running on Railway</div>
        <p><strong>Version:</strong> 7.1</p>
        <p><strong>Port:</strong> ${PORT}</p>
        <p><strong>Uptime:</strong> ${Math.floor(process.uptime())} seconds</p>
        
        <div class="feature">
            <h2>📋 Available Features:</h2>
            <ul class="feature-list">
                <li>WhatsApp Bulk Messaging</li>
                <li>User Authentication</li>
                <li>Campaign Management</li>
                <li>Contact Management</li>
                <li>Real-time Updates</li>
                <li>Anti-Ban Protection</li>
            </ul>
        </div>
        
        <a href="/health" class="btn">Health Check</a>
        <a href="/api" class="btn">API Info</a>
    </div>
</body>
</html>
    `);
});

// API info
app.get('/api', (req, res) => {
    res.json({
        name: 'WA Cloud Sender Seva API',
        version: '7.1',
        status: 'running',
        port: PORT,
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login'
            },
            health: 'GET /health',
            api: 'GET /api'
        }
    });
});

// Mount routes
app.use('/api/auth', authRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.url
    });
});

// Start server
server.listen(PORT, HOST, () => {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 WA CLOUD SENDER SEVA - Server Started!');
    console.log('='.repeat(70));
    console.log(`📡 Server running on ${HOST}:${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
    console.log('='.repeat(70) + '\n');
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    server.close(() => process.exit(0));
});

module.exports = { app, server };
