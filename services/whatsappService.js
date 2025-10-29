const makeWASocket = require('@whiskeysockets/baileys').default;
const { 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    makeInMemoryStore
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

class WhatsAppService {
    constructor() {
        this.sock = null;
        this.store = null;
        this.isConnected = false;
        this.qrCode = null;
        this.pairingCode = null;
        this.connectionAttempts = 0;
        this.maxRetries = 5;
    }

    // Initialize WhatsApp connection
    async connect(userId, phoneNumber = null) {
        try {
            const sessionPath = path.join(__dirname, '../sessions', userId);
            
            // Create session directory
            if (!fs.existsSync(sessionPath)) {
                fs.mkdirSync(sessionPath, { recursive: true });
            }

            // Initialize store
            this.store = makeInMemoryStore({ 
                logger: pino().child({ level: 'silent' }) 
            });
            
            // Load auth state
            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

            // Get latest Baileys version
            const { version } = await fetchLatestBaileysVersion();

            // Create socket
            this.sock = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                printQRInTerminal: true,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
                },
                browser: ['WA Cloud Sender Seva', 'Chrome', '3.0'],
                getMessage: async (key) => {
                    if (this.store) {
                        const msg = await this.store.loadMessage(key.remoteJid, key.id);
                        return msg?.message || undefined;
                    }
                    return undefined;
                }
            });

            // Bind store
            this.store?.bind(this.sock.ev);

            // Connection update handler
            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                // QR Code
                if (qr) {
                    this.qrCode = qr;
                    console.log('📱 QR Code generated:', qr);
                }

                // Connection status
                if (connection === 'close') {
                    const shouldReconnect = 
                        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                    
                    console.log('❌ Connection closed:', lastDisconnect?.error);
                    this.isConnected = false;

                    if (shouldReconnect && this.connectionAttempts < this.maxRetries) {
                        this.connectionAttempts++;
                        console.log(`🔄 Reconnecting... Attempt ${this.connectionAttempts}`);
                        setTimeout(() => this.connect(userId, phoneNumber), 5000);
                    }
                } else if (connection === 'open') {
                    console.log('✅ WhatsApp Connected Successfully!');
                    this.isConnected = true;
                    this.connectionAttempts = 0;
                    this.qrCode = null;
                    this.pairingCode = null;
                }
            });

            // Credentials update
            this.sock.ev.on('creds.update', saveCreds);

            // Request pairing code if phone number provided
            if (phoneNumber && !this.sock.authState.creds.registered) {
                console.log('📞 Requesting pairing code for:', phoneNumber);
                const code = await this.sock.requestPairingCode(phoneNumber);
                this.pairingCode = code;
                console.log('🔐 Pairing Code:', code);
                return { type: 'pairing_code', code };
            }

            return { type: 'qr_code', qr: this.qrCode };

        } catch (error) {
            console.error('❌ WhatsApp connection error:', error);
            throw error;
        }
    }

    // Send message
    async sendMessage(to, message, options = {}) {
        try {
            if (!this.isConnected || !this.sock) {
                throw new Error('WhatsApp not connected');
            }

            const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
            
            let sent;
            
            if (options.mediaUrl) {
                // Send media message
                sent = await this.sock.sendMessage(jid, {
                    [options.mediaType || 'image']: { url: options.mediaUrl },
                    caption: message
                });
            } else {
                // Send text message
                sent = await this.sock.sendMessage(jid, { text: message });
            }

            return {
                success: true,
                messageId: sent.key.id,
                timestamp: sent.messageTimestamp
            };

        } catch (error) {
            console.error('❌ Send message error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Send bulk messages with anti-ban
    async sendBulkMessages(contacts, message, options = {}) {
        const results = [];
        const delay = options.delay || 3000;
        const randomDelay = options.randomDelay || true;

        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            
            try {
                // Personalize message
                let personalizedMessage = message;
                if (contact.variables) {
                    Object.keys(contact.variables).forEach(key => {
                        personalizedMessage = personalizedMessage.replace(
                            new RegExp(`{{${key}}}`, 'g'),
                            contact.variables[key]
                        );
                    });
                }

                // Send message
                const result = await this.sendMessage(contact.phone, personalizedMessage, options);
                
                results.push({
                    contact: contact.phone,
                    status: result.success ? 'sent' : 'failed',
                    messageId: result.messageId,
                    error: result.error
                });

                // Anti-ban delay
                if (i < contacts.length - 1) {
                    const waitTime = randomDelay 
                        ? delay + Math.floor(Math.random() * 2000)
                        : delay;
                    
                    console.log(`⏳ Waiting ${waitTime}ms before next message...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }

            } catch (error) {
                results.push({
                    contact: contact.phone,
                    status: 'failed',
                    error: error.message
                });
            }
        }

        return results;
    }

    // Get connection status
    getStatus() {
        return {
            connected: this.isConnected,
            qrCode: this.qrCode,
            pairingCode: this.pairingCode,
            attempts: this.connectionAttempts
        };
    }

    // Disconnect
    async disconnect() {
        if (this.sock) {
            await this.sock.logout();
            this.sock = null;
            this.isConnected = false;
        }
    }
}

module.exports = new WhatsAppService();
