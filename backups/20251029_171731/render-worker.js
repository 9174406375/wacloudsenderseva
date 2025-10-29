/**
 * Background Worker - Keeps Render Service Alive
 */

const http = require('http');

const PORT = process.env.PORT || 10000;

// Create simple HTTP server
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Render Worker Active\n');
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Worker listening on port ${PORT}`);
});

// Keep alive ping
setInterval(() => {
    console.log('Worker alive:', new Date().toISOString());
}, 30000);
