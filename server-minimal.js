const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/health', (req, res) => {
    res.json({ status: 'ok', port: PORT });
});

app.get('/', (req, res) => {
    res.send('WA Cloud Sender Seva - Server Running!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on 0.0.0.0:${PORT}`);
});
