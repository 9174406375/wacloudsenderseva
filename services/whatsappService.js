/**
 * ═══════════════════════════════════════════════════════════════
 * ENHANCED WHATSAPP SERVICE - FINAL PRODUCTION
 * Features:
 * - QR Login + Mobile Number Linking
 * - User-defined delays
 * - Admin notification (1st time only)
 * - QR timer with countdown
 * - Session persistence
 * ═══════════════════════════════════════════════════════════════
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs-extra');
const path = require('path');

// Admin config
const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP || '919174406375';
const SESSION_PATH = './whatsapp-sessions';

// Active clients & status
const activeClients = new Map();
const clientStatus = new Map();
const adminNotified = new Map(); // Track if admin notified for this user

/**
 * ═══════════════════════════════════════════════════════════════
 * INITIALIZE CLIENT - QR + Mobile Number Support
 * ═══════════════════════════════════════════════════════════════
 */
async function initializeClient(userId, sessionId, options = {}) {
    try {
        console.log(`📱 Initializing WhatsApp for user ${userId}...`);

        const sessionPath = path.join(SESSION_PATH, userId.toString(), sessionId);
        await fs.ensureDir(sessionPath);

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false // We'll handle QR ourselves
        });

        const clientKey = `${userId}-${sessionId}`;
        activeClients.set(clientKey, sock);

        clientStatus.set(clientKey, {
            status: 'initializing',
            isReady: false,
            phoneNumber: null,
            qrExpiry: null
        });

        // Setup event handlers
        setupClientEvents(sock, userId, sessionId, options);

        // Save credentials
        sock.ev.on('creds.update', saveCreds);

        return { success: true, clientKey };

    } catch (error) {
        console.error('❌ Init failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * SETUP CLIENT EVENTS - Enhanced with Timer & Admin Logic
 * ═══════════════════════════════════════════════════════════════
 */
function setupClientEvents(sock, userId, sessionId, options = {}) {
    const clientKey = `${userId}-${sessionId}`;
    const { io, User } = options;

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // QR CODE EVENT with Timer
        if (qr) {
            console.log('📱 QR Code generated with 60s timer');
            
            // Generate QR image
            const qrImage = await QRCode.toDataURL(qr);
            
            // Set expiry (60 seconds from now)
            const qrExpiry = Date.now() + 60000;
            
            clientStatus.set(clientKey, {
                ...clientStatus.get(clientKey),
                status: 'qr_pending',
                qrCode: qr,
                qrImage: qrImage,
                qrExpiry: qrExpiry,
                qrTimer: 60
            });

            if (io) {
                io.to(`user_${userId}`).emit('whatsapp:qr', {
                    sessionId,
                    qrCode: qr,
                    qrImage: qrImage,
                    expiryTime: qrExpiry,
                    timer: 60,
                    message: 'Scan within 60 seconds'
                });

                // Start countdown timer
                startQRTimer(clientKey, userId, io);
            }
        }

        // CONNECTION OPENED
        if (connection === 'open') {
            console.log('✅ WhatsApp connected!');
            
            const phoneNumber = sock.user.id.split(':')[0];
            const userName = sock.user.name || 'User';
            
            clientStatus.set(clientKey, {
                status: 'connected',
                isReady: true,
                phoneNumber: phoneNumber,
                name: userName,
                connectedAt: Date.now()
            });

            // Send admin notification ONLY if first time
            if (!adminNotified.get(userId)) {
                await sendAdminNotification(userId, phoneNumber, userName);
                adminNotified.set(userId, true); // Mark as notified
            }

            if (io) {
                io.to(`user_${userId}`).emit('whatsapp:ready', {
                    sessionId,
                    phoneNumber,
                    name: userName,
                    message: 'WhatsApp connected successfully'
                });
            }

            // Save to database
            if (User) {
                try {
                    await User.findByIdAndUpdate(userId, {
                        $set: {
                            'whatsappSessions.$[session].status': 'connected',
                            'whatsappSessions.$[session].phoneNumber': phoneNumber,
                            'whatsappSessions.$[session].name': userName,
                            'whatsappSessions.$[session].isActive': true,
                            'whatsappSessions.$[session].connectedAt': Date.now()
                        }
                    }, {
                        arrayFilters: [{ 'session.sessionId': sessionId }]
                    });
                } catch (err) {
                    console.error('DB update failed:', err);
                }
            }
        }

        // CONNECTION CLOSED
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed:', shouldReconnect ? 'reconnecting...' : 'logged out');
            
            if (shouldReconnect) {
                setTimeout(() => initializeClient(userId, sessionId, options), 5000);
            } else {
                activeClients.delete(clientKey);
                clientStatus.delete(clientKey);
            }
        }
    });
}

/**
 * ═══════════════════════════════════════════════════════════════
 * QR TIMER - Countdown from 60 seconds
 * ═══════════════════════════════════════════════════════════════
 */
function startQRTimer(clientKey, userId, io) {
    let timer = 60;
    
    const interval = setInterval(() => {
        timer--;
        
        const status = clientStatus.get(clientKey);
        if (status) {
            status.qrTimer = timer;
            clientStatus.set(clientKey, status);
        }

        // Emit timer update
        io.to(`user_${userId}`).emit('whatsapp:qr:timer', {
            timer,
            message: `QR expires in ${timer}s`
        });

        // Timer expired
        if (timer <= 0) {
            clearInterval(interval);
            io.to(`user_${userId}`).emit('whatsapp:qr:expired', {
                message: 'QR code expired. Click to generate new QR.'
            });
        }

        // Connected, stop timer
        if (status && status.status === 'connected') {
            clearInterval(interval);
        }

    }, 1000);
}

/**
 * ═══════════════════════════════════════════════════════════════
 * SEND MESSAGE
 * ═══════════════════════════════════════════════════════════════
 */
async function sendMessage(userId, sessionId, phoneNumber, message) {
    try {
        const clientKey = `${userId}-${sessionId}`;
        const sock = activeClients.get(clientKey);

        if (!sock) {
            return { success: false, error: 'WhatsApp not connected' };
        }

        const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: message });

        return {
            success: true,
            phoneNumber,
            timestamp: Date.now()
        };

    } catch (error) {
        return {
            success: false,
            error: error.message,
            phoneNumber
        };
    }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * SEND BULK MESSAGES - User-Defined Delays
 * ═══════════════════════════════════════════════════════════════
 */
async function sendBulkMessages(userId, sessionId, recipients, message, options = {}) {
    const {
        minDelay = 3000,        // User can set
        maxDelay = 10000,       // User can set
        batchSize = 20,         // User can set
        cooldown = 60000,       // User can set
        dailyPercentage = 100,  // User can set
        onProgress = null
    } = options;

    console.log(`📊 Bulk Settings: Delay ${minDelay}-${maxDelay}ms, Batch ${batchSize}, Cooldown ${cooldown}ms`);

    // Calculate contacts for today
    const totalContacts = recipients.length;
    const contactsToday = Math.ceil((totalContacts * dailyPercentage) / 100);
    const recipientsToday = recipients.slice(0, contactsToday);

    const results = {
        total: contactsToday,
        sent: 0,
        failed: 0,
        success: [],
        failures: []
    };

    // Process in batches
    for (let i = 0; i < recipientsToday.length; i += batchSize) {
        const batch = recipientsToday.slice(i, i + batchSize);

        for (const recipient of batch) {
            try {
                // USER-DEFINED RANDOM DELAY
                const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
                await sleep(delay);

                // Variable replacement
                const personalizedMessage = message
                    .replace(/\{\{name\}\}/gi, recipient.name || 'Customer')
                    .replace(/\{\{phone\}\}/gi, recipient.phone || '')
                    .replace(/\{\{email\}\}/gi, recipient.email || '')
                    .replace(/\{\{city\}\}/gi, recipient.location?.city || '')
                    .replace(/\{\{village\}\}/gi, recipient.location?.village || '');

                // Send message
                const result = await sendMessage(userId, sessionId, recipient.phone, personalizedMessage);

                if (result.success) {
                    results.sent++;
                    results.success.push(recipient);

                    if (onProgress) {
                        onProgress({
                            status: 'sent',
                            color: 'green',
                            total: results.total,
                            sent: results.sent,
                            failed: results.failed,
                            current: recipient
                        });
                    }

                } else {
                    results.failed++;
                    results.failures.push({ ...recipient, error: result.error });

                    if (onProgress) {
                        onProgress({
                            status: 'failed',
                            color: 'red',
                            total: results.total,
                            sent: results.sent,
                            failed: results.failed,
                            current: recipient,
                            error: result.error
                        });
                    }
                }

            } catch (error) {
                results.failed++;
                results.failures.push({ ...recipient, error: error.message });
            }
        }

        // Cooldown between batches
        if (i + batchSize < recipientsToday.length) {
            console.log(`⏳ Cooldown: ${cooldown/1000}s`);
            
            if (onProgress) {
                onProgress({
                    status: 'cooldown',
                    color: 'yellow',
                    duration: cooldown
                });
            }

            await sleep(cooldown);
        }
    }

    return { success: true, results };
}

/**
 * ═══════════════════════════════════════════════════════════════
 * SEND ADMIN NOTIFICATION - Only 1st Time!
 * ═══════════════════════════════════════════════════════════════
 */
async function sendAdminNotification(userId, phoneNumber, userName) {
    try {
        console.log(`📧 Sending 1st-time admin notification...`);

        const message = `
🎉 *NEW USER CONNECTED*

👤 User: ${userName}
📱 Phone: ${phoneNumber}
🆔 ID: ${userId}
⏰ ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}

✅ First WhatsApp connection
🚀 Ready to send bulk messages!

_WA Cloud Sender Seva_
        `.trim();

        // Find any active client to send
        const adminClient = findAdminClient();
        if (adminClient) {
            await adminClient.sendMessage(`${ADMIN_WHATSAPP}@s.whatsapp.net`, { text: message });
            console.log('✅ Admin notified');
        }

        return { success: true };

    } catch (error) {
        console.error('Admin notification failed:', error);
        return { success: false };
    }
}

function findAdminClient() {
    for (const [key, client] of activeClients.entries()) {
        const status = clientStatus.get(key);
        if (status && status.isReady) {
            return client;
        }
    }
    return null;
}

function getClientStatus(userId, sessionId) {
    const clientKey = `${userId}-${sessionId}`;
    return clientStatus.get(clientKey) || { status: 'not_initialized', isReady: false };
}

async function disconnectClient(userId, sessionId) {
    const clientKey = `${userId}-${sessionId}`;
    const sock = activeClients.get(clientKey);
    if (sock) {
        await sock.logout();
        activeClients.delete(clientKey);
        clientStatus.delete(clientKey);
    }
    return { success: true };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    initializeClient,
    disconnectClient,
    getClientStatus,
    sendMessage,
    sendBulkMessages,
    sendAdminNotification,
    activeClients,
    clientStatus
};
