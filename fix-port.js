// Add this at the very beginning of server.js
const PORT = process.env.PORT || 10000;

// Make sure server.listen is using 0.0.0.0
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
