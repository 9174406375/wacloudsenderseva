/**
 * WA CLOUD SENDER SEVA - RENDER COMPATIBLE v7.1
 * Minimal working version for Render.com
 */

const express = require('express');
const http = require('http');
const path = require('path');

// PORT configuration (Render will set this)
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check (CRITICAL for Render)
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
        a {
            color: white;
            text-decoration: none;
            background: #3b82f6;
            padding: 15px 30px;
            border-radius: 10px;
            display: inline-block;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 WA Cloud Sender Seva</h1>
        <div class="status">✅ Server Running</div>
        <p>Version: 7.1</p>
        <p>Port: ${PORT}</p>
        <p>Uptime: ${Math.floor(process.uptime())} seconds</p>
        <a href="/health">Health Check</a>
    </div>
</body>
</html>
    `);
});

// API routes will be added later
app.get('/api', (req, res) => {
    res.json({
        name: 'WA Cloud Sender Seva API',
        version: '7.1',
        status: 'running',
        port: PORT,
        endpoints: {
            health: '/health',
            api: '/api'
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});

// Start server - CRITICAL: Must bind to 0.0.0.0
server.listen(PORT, HOST, () => {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 WA CLOUD SENDER SEVA - Server Started!');
    console.log('='.repeat(70));
    console.log(`📡 Server running on ${HOST}:${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
    console.log('='.repeat(70) + '\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = { app, server };
