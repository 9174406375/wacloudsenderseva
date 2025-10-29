/**
 * WhatsApp Service - Production Version (Railway)
 * This file will be used when deployed on Railway
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

class WhatsAppService {
    constructor() {
        this.clients = new Map();
        console.log('✅ WhatsApp Service initialized (Production mode)');
    }

    async initializeClient(userId) {
        try {
            if (this.clients.has(userId)) {
                return { success: false, message: 'Client already exists' };
            }

            const client = new Client({
                authStrategy: new LocalAuth({ clientId: userId }),
                puppeteer: {
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                }
            });

            client.on('qr', (qr) => {
                console.log(`📱 QR Code for user ${userId}:`);
                qrcode.generate(qr, { small: true });
            });

            client.on('ready', () => {
                console.log(`✅ WhatsApp ready for ${userId}`);
            });

            client.on('disconnected', () => {
                this.clients.delete(userId);
            });

            this.clients.set(userId, client);
            await client.initialize();

            return { success: true, message: 'Initialized successfully' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    getClient(userId) {
        return this.clients.get(userId);
    }

    async sendMessage(userId, phone, message) {
        const client = this.getClient(userId);
        if (!client) {
            return { success: false, message: 'Not connected' };
        }

        try {
            await client.sendMessage(`${phone.replace(/[^0-9]/g, '')}@c.us`, message);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async sendBulkMessages(userId, recipients, message) {
        const client = this.getClient(userId);
        if (!client) {
            return { success: false, message: 'Not connected' };
        }

        const results = { total: recipients.length, sent: 0, failed: 0, failedNumbers: [] };

        for (const recipient of recipients) {
            try {
                await client.sendMessage(`${recipient.replace(/[^0-9]/g, '')}@c.us`, message);
                results.sent++;
                await new Promise(resolve => setTimeout(resolve, 5000)); // Anti-ban delay
            } catch (error) {
                results.failed++;
                results.failedNumbers.push(recipient);
            }
        }

        return { success: true, results };
    }

    async disconnectClient(userId) {
        const client = this.getClient(userId);
        if (client) {
            await client.destroy();
            this.clients.delete(userId);
        }
        return { success: true };
    }
}

module.exports = new WhatsAppService();
