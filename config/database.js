/**
 * ═══════════════════════════════════════════════════════════════
 * DATABASE CONNECTION - Production Ready
 * ═══════════════════════════════════════════════════════════════
 */

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000;

async function connectDB() {
    let retries = 0;

    while (retries < MAX_RETRIES) {
        try {
            console.log(`🔄 MongoDB attempt ${retries + 1}/${MAX_RETRIES}...`);

            await mongoose.connect(MONGODB_URI, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 30000,
                socketTimeoutMS: 75000,
                family: 4
            });

            console.log('✅ MongoDB connected');
            return true;

        } catch (error) {
            retries++;
            console.error(`❌ Attempt ${retries} failed:`, error.message);

            if (retries < MAX_RETRIES) {
                console.log(`⏳ Retrying in ${RETRY_DELAY/1000}s...`);
                await new Promise(r => setTimeout(r, RETRY_DELAY));
            }
        }
    }

    console.error('❌ MongoDB connection failed after all retries');
    return false;
}

mongoose.connection.on('connected', () => {
    console.log('📊 Mongoose connected');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Mongoose error:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️ Mongoose disconnected');
});

module.exports = { connectDB };
