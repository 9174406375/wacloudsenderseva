const whatsappService = require('./whatsappService');

class MessageService {
    // Send bulk messages with progress tracking
    async sendBulkMessages(contacts, message, options = {}) {
        const results = [];
        const total = contacts.length;
        let sent = 0;

        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            
            try {
                // Personalize message with variables
                let personalizedMessage = this.personalizeMessage(message, contact);

                // Send message
                const result = await whatsappService.sendMessage(
                    contact.phone,
                    personalizedMessage,
                    {
                        mediaUrl: options.mediaUrl,
                        mediaType: options.mediaType
                    }
                );

                results.push({
                    phone: contact.phone,
                    status: result.success ? 'sent' : 'failed',
                    messageId: result.messageId,
                    error: result.error,
                    timestamp: new Date()
                });

                if (result.success) {
                    sent++;
                    
                    // Call progress callback
                    if (options.onProgress) {
                        options.onProgress(sent, total);
                    }
                }

                // Anti-ban delay
                if (i < contacts.length - 1) {
                    const delay = this.calculateDelay(options);
                    console.log(`⏳ Waiting ${delay}ms...`);
                    await this.sleep(delay);
                }

            } catch (error) {
                console.error(`Error sending to ${contact.phone}:`, error);
                results.push({
                    phone: contact.phone,
                    status: 'failed',
                    error: error.message,
                    timestamp: new Date()
                });
            }
        }

        return results;
    }

    // Personalize message with variables
    personalizeMessage(message, contact) {
        let personalized = message;

        // Replace {{name}}
        if (contact.name) {
            personalized = personalized.replace(/\{\{name\}\}/g, contact.name);
        }

        // Replace other variables
        if (contact.variables) {
            Object.keys(contact.variables).forEach(key => {
                const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                personalized = personalized.replace(regex, contact.variables[key]);
            });
        }

        return personalized;
    }

    // Calculate delay with randomization
    calculateDelay(options) {
        const baseDelay = options.delay || 3000;
        
        if (options.randomDelay) {
            const min = options.randomDelayRange?.min || 2000;
            const max = options.randomDelayRange?.max || 5000;
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        return baseDelay;
    }

    // Sleep utility
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Send single message
    async sendSingleMessage(phone, message, options = {}) {
        return await whatsappService.sendMessage(phone, message, options);
    }
}

module.exports = new MessageService();
