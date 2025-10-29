/**
 * WhatsApp Service - Placeholder
 * Note: WhatsApp Web.js requires Puppeteer which is not supported on Android/Termux
 * This will be enabled when deploying to Railway/production server
 */

class WhatsAppService {
    constructor() {
        console.log('⚠️  WhatsApp Service: Disabled in Termux (Puppeteer not supported)');
        console.log('✅ Will be enabled automatically on Railway deployment');
    }

    async initializeClient(userId) {
        return {
            success: false,
            message: 'WhatsApp temporarily disabled (Termux limitation). Will work on Railway.'
        };
    }

    getClient(userId) {
        return null;
    }

    async sendMessage(userId, phone, message) {
        return {
            success: false,
            message: 'WhatsApp disabled in Termux environment'
        };
    }

    async sendBulkMessages(userId, recipients, message) {
        return {
            success: false,
            message: 'WhatsApp disabled in Termux environment',
            results: {
                total: recipients.length,
                sent: 0,
                failed: recipients.length,
                failedNumbers: recipients
            }
        };
    }

    async disconnectClient(userId) {
        return { success: true, message: 'No active client' };
    }
}

module.exports = new WhatsAppService();
