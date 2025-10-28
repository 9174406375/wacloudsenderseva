const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const config = require('./config');
const db = require('./database');
const fs = require('fs').promises;
const path = require('path');

class WhatsAppClient {
    constructor() {
        this.client = null;
        this.isReady = false;
        this.qrCode = null;
        this.messageQueue = [];
        this.isProcessing = false;
    }

    async initialize() {
        console.log('🚀 Initializing WhatsApp Client...');
        
        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: './whatsapp-session'
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu'
                ]
            }
        });

        this.setupEventHandlers();
        await this.client.initialize();
    }

    setupEventHandlers() {
        this.client.on('qr', (qr) => {
            console.log('📱 QR Code received! Scan करें WhatsApp से:');
            qrcode.generate(qr, { small: true });
            this.qrCode = qr;
        });

        this.client.on('ready', async () => {
            console.log('✅ WhatsApp Client is READY!');
            this.isReady = true;
            this.qrCode = null;
            
            const info = this.client.info;
            console.log(`📞 Connected as: ${info.pushname} (${info.wid.user})`);
        });

        this.client.on('authenticated', () => {
            console.log('🔐 Authentication successful!');
        });

        this.client.on('auth_failure', (msg) => {
            console.error('❌ Authentication failed:', msg);
            this.isReady = false;
        });

        this.client.on('disconnected', (reason) => {
            console.log('🔌 Disconnected:', reason);
            this.isReady = false;
            this.qrCode = null;
        });

        this.client.on('message', async (message) => {
            // Log incoming messages
            console.log(`📩 Message from ${message.from}: ${message.body}`);
        });
    }

    async sendMessage(phoneNumber, message, mediaPath = null, delay = 2000) {
        if (!this.isReady) {
            throw new Error('WhatsApp client is not ready. Please scan QR code first.');
        }

        try {
            // Format phone number
            const formattedNumber = this.formatPhoneNumber(phoneNumber);
            const chatId = formattedNumber + '@c.us';

            // Check if number exists on WhatsApp
            const numberExists = await this.client.isRegisteredUser(chatId);
            if (!numberExists) {
                throw new Error(`Number ${phoneNumber} is not registered on WhatsApp`);
            }

            // Add delay before sending
            await this.sleep(delay);

            // Send message with or without media
            if (mediaPath) {
                const media = await MessageMedia.fromFilePath(mediaPath);
                await this.client.sendMessage(chatId, media, { 
                    caption: message || '' 
                });
            } else {
                await this.client.sendMessage(chatId, message);
            }

            console.log(`✅ Message sent to ${formattedNumber}`);
            return { 
                success: true, 
                phoneNumber: formattedNumber,
                timestamp: new Date()
            };

        } catch (error) {
            console.error(`❌ Failed to send to ${phoneNumber}:`, error.message);
            return { 
                success: false, 
                phoneNumber,
                error: error.message,
                timestamp: new Date()
            };
        }
    }

    formatPhoneNumber(number) {
        // Remove all non-numeric characters
        let cleaned = number.toString().replace(/D/g, '');
        
        // If doesn't start with 91, add it
        if (!cleaned.startsWith('91')) {
            cleaned = '91' + cleaned;
        }

        return cleaned;
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStatus() {
        return {
            isReady: this.isReady,
            hasQR: !!this.qrCode,
            qrCode: this.qrCode,
            clientInfo: this.client && this.isReady ? {
                name: this.client.info.pushname,
                number: this.client.info.wid.user
            } : null
        };
    }

    async logout() {
        if (this.client) {
            console.log('🔓 Logging out...');
            await this.client.logout();
            await this.client.destroy();
            this.isReady = false;
            this.qrCode = null;
            console.log('✅ Logged out successfully');
        }
    }

    async getChats() {
        if (!this.isReady) {
            throw new Error('WhatsApp client not ready');
        }
        return await this.client.getChats();
    }

    async getContacts() {
        if (!this.isReady) {
            throw new Error('WhatsApp client not ready');
        }
        return await this.client.getContacts();
    }
}

module.exports = new WhatsAppClient();
