/**
 * ═══════════════════════════════════════════════════════════════
 * WHATSAPP SERVICE - Using Baileys (Termux Compatible!)
 * Mobile number authentication + Admin notifications
 * ═══════════════════════════════════════════════════════════════
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs-extra');
const path = require('path');

// Admin configuration
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'sachinbamniya0143@gmail.com';
const ADMIN_PHONE = process.env.ADMIN_PHONE || '+919174406375';
const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP || '919174406375';

// Session storage
const SESSION_PATH = process.env.WHATSAPP_SESSION_PATH || './whatsapp-sessions';

// Active clients
const activeClients = new Map();
const clientStatus = new Map();

/**
 * ═══════════════════════════════════════════════════════════════
 * INITIALIZE CLIENT
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
            printQRInTerminal: true
        });

        const clientKey = `${userId}-${sessionId}`;
        activeClients.set(clientKey, sock);

        clientStatus.set(clientKey, {
            status: 'initializing',
            isReady: false,
            phoneNumber: null
        });

        // Connection update
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('📱 QR Code generated');
                qrcode.generate(qr, { small: true });
                
                clientStatus.set(clientKey, {
                    ...clientStatus.get(clientKey),
                    status: 'qr_pending',
                    qrCode: qr
                });

                if (options.io) {
                    options.io.to(`user_${userId}`).emit('whatsapp:qr', {
                        sessionId,
                        qrCode: qr
                    });
                }
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('❌ Connection closed:', shouldReconnect ? 'reconnecting...' : 'logged out');
                
                if (shouldReconnect) {
                    await initializeClient(userId, sessionId, options);
                }
            } else if (connection === 'open') {
                console.log('✅ WhatsApp connected!');
                
                const phoneNumber = sock.user.id.split(':')[0];
                
                clientStatus.set(clientKey, {
                    status: 'connected',
                    isReady: true,
                    phoneNumber: phoneNumber,
                    name: sock.user.name
                });

                if (options.io) {
                    options.io.to(`user_${userId}`).emit('whatsapp:ready', {
                        sessionId,
                        phoneNumber,
                        name: sock.user.name
                    });
                }

                // Send admin notification
                await sendAdminNotification(userId, phoneNumber, sock.user.name);
            }
        });

        // Save credentials
        sock.ev.on('creds.update', saveCreds);

        return { success: true, clientKey };

    } catch (error) {
        console.error('❌ Failed to initialize:', error);
        return { success: false, error: error.message };
    }
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
            phoneNumber: phoneNumber,
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
 * SEND BULK MESSAGES
 * ═══════════════════════════════════════════════════════════════
 */
async function sendBulkMessages(userId, sessionId, recipients, message, options = {}) {
    const {
        minDelay = 3000,
        maxDelay = 10000,
        batchSize = 20,
        cooldown = 60000,
        onProgress = null
    } = options;

    const results = {
        total: recipients.length,
        sent: 0,
        failed: 0,
        success: [],
        failures: []
    };

    for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);

        for (const recipient of batch) {
            const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
            await sleep(delay);

            const result = await sendMessage(userId, sessionId, recipient.phone, message);

            if (result.success) {
                results.sent++;
                results.success.push(recipient);
            } else {
                results.failed++;
                results.failures.push({ ...recipient, error: result.error });
            }

            if (onProgress) {
                onProgress({
                    total: results.total,
                    sent: results.sent,
                    failed: results.failed,
                    current: recipient
                });
            }
        }

        if (i + batchSize < recipients.length) {
            console.log(`⏳ Cooldown: ${cooldown/1000}s`);
            await sleep(cooldown);
        }
    }

    return { success: true, results };
}

/**
 * ═══════════════════════════════════════════════════════════════
 * SEND ADMIN NOTIFICATION
 * ═══════════════════════════════════════════════════════════════
 */
async function sendAdminNotification(userId, phoneNumber, userName) {
    try {
        console.log(`📧 Sending admin notification...`);

        const message = `
🎉 *NEW WHATSAPP CONNECTION*

👤 User: ${userName}
📱 Phone: ${phoneNumber}
🆔 User ID: ${userId}
⏰ Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}

✅ Ready to send bulk messages!

_WA Cloud Sender Seva_
        `.trim();

        // Send to admin (using any active client)
        const adminClient = findAdminClient();
        if (adminClient) {
            await adminClient.sendMessage(`${ADMIN_WHATSAPP}@s.whatsapp.net`, { text: message });
            console.log('✅ Admin notified on WhatsApp');
        }

        return { success: true };
    } catch (error) {
        console.error('Failed to notify admin:', error);
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
