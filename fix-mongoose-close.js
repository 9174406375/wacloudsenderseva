const fs = require('fs');

// Read server.js
let serverCode = fs.readFileSync('server.js', 'utf8');

// Fix old Mongoose close (with callback) to new async/await
serverCode = serverCode.replace(
  /mongoose.connection.close(([^)]*)s*=>s*{[^}]+})/g,
  'await mongoose.connection.close()'
);

// Also fix process handlers
serverCode = serverCode.replace(
  /process.on('SIGTERM',s*()s*=>s*{[sS]*?mongoose.connection.close([^)]*)[sS]*?})/g,
  `process.on('SIGTERM', async () => {
  console.log('⚠️ SIGTERM received. Shutting down gracefully...');
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error closing MongoDB:', err);
    process.exit(1);
  }
})`
);

serverCode = serverCode.replace(
  /process.on('SIGINT',s*()s*=>s*{[sS]*?mongoose.connection.close([^)]*)[sS]*?})/g,
  `process.on('SIGINT', async () => {
  console.log('⚠️ SIGINT received. Shutting down gracefully...');
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error closing MongoDB:', err);
    process.exit(1);
  }
})`
);

// Write fixed server.js
fs.writeFileSync('server.js', serverCode);
console.log('✅ server.js fixed - Mongoose close() updated to async/await');
