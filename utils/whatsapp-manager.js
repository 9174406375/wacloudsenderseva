/**
 * ================================================
 * WA CLOUD SENDER SEVA - WHATSAPP MANAGER
 * Version: 2.0.0 | Baileys v6.7.8
 * Complete File with All Parts
 * ================================================
 */

const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
    delay
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const NodeCache = require('node-cache');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const { Boom } = require('@hapi/boom');

const msgRetryCounterCache = new NodeCache({ stdTTL: 300 });
const activeSessions = new Map();
const SESSION_DIR = path.join(process.cwd(), 'sessions');

if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
}

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    }
});

class WhatsAppManager {
    constructor(io) {
        this.io = io;
        this.sessions = activeSessions;
        logger.info('WhatsAppManager initialized');
    }

    getSessionPath(sessionId) {
        return path.join(SESSION_DIR, sessionId);
    }

    async createSession(sessionId, userId, sessionName, io) {
        try {
            if (this.sessions.has(sessionId)) {
                logger.warn(`Session ${sessionId} already exists`);
                return { success: false, error: 'Session already exists' };
            }

            logger.info(`Creating session: ${sessionId}`);
            const sessionPath = this.getSessionPath(sessionId);

            if (!fs.existsSync(sessionPath)) {
                fs.mkdirSync(sessionPath, { recursive: true });
            }

            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
            const { version } = await fetchLatestBaileysVersion();

            const sock = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                browser: Browsers.ubuntu('Chrome'),
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, logger)
                },
                msgRetryCounterCache,
                generateHighQualityLinkPreview: true,
                getMessage: async (key) => {
                    return { conversation: 'Message not found' };
                }
            });

            const sessionInfo = {
                sessionId,
                userId,
                sessionName,
                sock,
                status: 'connecting',
                qrRetries: 0,
                phoneNumber: null,
                connectedAt: null,
                messagesSent: 0,
                messagesReceived: 0
            };

            this.sessions.set(sessionId, sessionInfo);
            this.setupEventHandlers(sock, sessionId, userId, sessionName, saveCreds, io);

            logger.info(`Session ${sessionId} created successfully`);
            return { success: true, sessionId, status: 'waiting_for_qr' };

        } catch (error) {
            logger.error(`Error creating session ${sessionId}:`, error);
            return { success: false, error: error.message };
        }
    }

    setupEventHandlers(sock, sessionId, userId, sessionName, saveCreds, io) {
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                try {
                    const qrImage = await qrcode.toDataURL(qr);
                    logger.info(`QR code generated for session: ${sessionId}`);
                    io.to(userId).emit('session:qr', { sessionId, sessionName, qrCode: qrImage });
                } catch (error) {
                    logger.error(`QR generation error:`, error);
                }
            }

            if (connection === 'open') {
                logger.info(`✅ Session ${sessionId} connected`);
                const session = this.sessions.get(sessionId);
                if (session) {
                    session.status = 'connected';
                    session.connectedAt = new Date();
                    session.phoneNumber = sock.user?.id.split(':')[0];
                }
                io.to(userId).emit('session:connected', {
                    sessionId,
                    sessionName,
                    phoneNumber: sock.user?.id.split(':')[0],
                    status: 'connected'
                });
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error instanceof Boom &&
                    lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut;

                if (shouldReconnect) {
                    logger.info(`Reconnecting session ${sessionId}...`);
                    await delay(3000);
                    this.createSession(sessionId, userId, sessionName, io);
                } else {
                    this.sessions.delete(sessionId);
                    io.to(userId).emit('session:disconnected', { sessionId, reason: 'logged_out' });
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);
    }

    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    getUserSessions(userId) {
        const userSessions = [];
        this.sessions.forEach((session, sessionId) => {
            if (session.userId === userId) {
                userSessions.push({
                    sessionId,
                    sessionName: session.sessionName,
                    status: session.status,
                    phoneNumber: session.phoneNumber,
                    messagesSent: session.messagesSent || 0,
                    connectedAt: session.connectedAt
                });
            }
        });
        return userSessions;
    }

    async disconnectSession(sessionId) {
        try {
            const session = this.sessions.get(sessionId);
            if (!session) {
                return { success: false, error: 'Session not found' };
            }

            if (session.sock) {
                await session.sock.logout();
                session.sock.end();
            }

            this.sessions.delete(sessionId);
            this.cleanupSession(sessionId);

            return { success: true };
        } catch (error) {
            logger.error(`Error disconnecting session:`, error);
            return { success: false, error: error.message };
        }
    }

    cleanupSession(sessionId) {
        try {
            const sessionPath = this.getSessionPath(sessionId);
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
            }
        } catch (error) {
            logger.error(`Error cleaning up session:`, error);
        }
    }

    async sendMessage(sessionId, recipientNumber, message) {
        try {
            const session = this.sessions.get(sessionId);
            if (!session || session.status !== 'connected') {
                throw new Error('Session not connected');
            }

            const jid = this.formatJID(recipientNumber);
            const result = await session.sock.sendMessage(jid, { text: message });
            
            session.messagesSent = (session.messagesSent || 0) + 1;
            
            return { success: true, messageId: result.key.id };
        } catch (error) {
            logger.error(`Error sending message:`, error);
            return { success: false, error: error.message };
        }
    }

    async sendImageMessage(sessionId, recipientNumber, imageUrl, caption = '') {
        try {
            const session = this.sessions.get(sessionId);
            if (!session || session.status !== 'connected') {
                throw new Error('Session not connected');
            }

            const jid = this.formatJID(recipientNumber);
            const axios = require('axios');
            
            let imageBuffer;
            if (imageUrl.startsWith('http')) {
                const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
                imageBuffer = Buffer.from(response.data);
            } else {
                imageBuffer = fs.readFileSync(imageUrl);
            }

            const result = await session.sock.sendMessage(jid, { image: imageBuffer, caption });
            session.messagesSent = (session.messagesSent || 0) + 1;

            return { success: true, messageId: result.key.id };
        } catch (error) {
            logger.error(`Error sending image:`, error);
            return { success: false, error: error.message };
        }
    }

    formatJID(phoneNumber) {
        let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (cleanNumber.startsWith('0')) {
            cleanNumber = cleanNumber.substring(1);
        }
        if (!cleanNumber.startsWith('91') && cleanNumber.length === 10) {
            cleanNumber = '91' + cleanNumber;
        }
        return `${cleanNumber}@s.whatsapp.net`;
    }

    async fetchGroups(sessionId) {
        try {
            const session = this.sessions.get(sessionId);
            if (!session || session.status !== 'connected') {
                throw new Error('Session not connected');
            }

            const groups = await session.sock.groupFetchAllParticipating();
            const groupsList = Object.values(groups).map(group => ({
                id: group.id,
                name: group.subject,
                participants: group.participants.length,
                owner: group.owner,
                description: group.desc || ''
            }));

            return { success: true, groups: groupsList, totalGroups: groupsList.length };
        } catch (error) {
            logger.error(`Error fetching groups:`, error);
            return { success: false, error: error.message, groups: [] };
        }
    }

    async extractGroupContacts(sessionId, groupIds) {
        try {
            const session = this.sessions.get(sessionId);
            if (!session || session.status !== 'connected') {
                throw new Error('Session not connected');
            }

            const allContacts = [];
            const contactsMap = new Map();

            for (const groupId of groupIds) {
                const metadata = await session.sock.groupMetadata(groupId);
                metadata.participants.forEach(participant => {
                    const number = participant.id.split('@')[0];
                    if (!contactsMap.has(number)) {
                        contactsMap.set(number, {
                            number,
                            name: participant.notify || 'Unknown',
                            groupName: metadata.subject,
                            groupId: metadata.id,
                            addedAt: new Date()
                        });
                    }
                });
            }

            allContacts.push(...contactsMap.values());

            return {
                success: true,
                contacts: allContacts,
                totalContacts: allContacts.length
            };
        } catch (error) {
            logger.error(`Error extracting contacts:`, error);
            return { success: false, error: error.message };
        }
    }

    getStats() {
        const stats = {
            totalSessions: this.sessions.size,
            connectedSessions: 0,
            totalMessagesSent: 0
        };

        this.sessions.forEach(session => {
            if (session.status === 'connected') {
                stats.connectedSessions++;
            }
            stats.totalMessagesSent += session.messagesSent || 0;
        });

        return stats;
    }
}

let waManagerInstance = null;

function getWhatsAppManager(io) {
    if (!waManagerInstance) {
        waManagerInstance = new WhatsAppManager(io);
    }
    return waManagerInstance;
}

module.exports = { WhatsAppManager, getWhatsAppManager };
