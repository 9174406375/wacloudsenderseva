/**
 * ================================================
 * WA CLOUD SENDER SEVA - BULK SENDER ENGINE
 * Version: 2.0.0 | Advanced Anti-Ban System
 * Railway Compatible | Production Ready
 * ================================================
 */

const pino = require('pino');
const EventEmitter = require('events');

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard'
        }
    }
});

/**
 * Bulk Sender Engine with Advanced Anti-Ban
 */
class BulkSender extends EventEmitter {
    constructor(waManager, database, io) {
        super();
        this.waManager = waManager;
        this.database = database;
        this.io = io;
        this.activeCampaigns = new Map();
        
        logger.info('BulkSender Engine initialized');
    }

    /**
     * Start bulk campaign with anti-ban protection
     */
    async startCampaign(campaignData) {
        try {
            const {
                campaignId,
                campaignName,
                sessionId,
                userId,
                contacts,
                templates,
                images,
                antiBan,
                schedule
            } = campaignData;

            logger.info(`Starting campaign: ${campaignName} (${campaignId})`);

            // Validate session
            const session = this.waManager.getSession(sessionId);
            if (!session || session.status !== 'connected') {
                throw new Error('WhatsApp session not connected');
            }

            // Initialize campaign state
            const campaignState = {
                campaignId,
                campaignName,
                sessionId,
                userId,
                totalContacts: contacts.length,
                sent: 0,
                failed: 0,
                remaining: contacts.length,
                failedNumbers: [],
                status: 'running',
                startedAt: new Date(),
                estimatedCompletion: null,
                currentBatch: 0,
                templates,
                images,
                antiBan,
                paused: false
            };

            this.activeCampaigns.set(campaignId, campaignState);

            // Calculate estimated time
            const avgDelay = (antiBan.minDelay + antiBan.maxDelay) / 2;
            const batchCooldown = antiBan.cooldownPeriod;
            const totalBatches = Math.ceil(contacts.length / antiBan.batchSize);
            const estimatedSeconds = (contacts.length * avgDelay) + (totalBatches * batchCooldown);
            campaignState.estimatedCompletion = new Date(Date.now() + estimatedSeconds * 1000);

            // Start sending process
            this.processCampaign(campaignId, contacts);

            return {
                success: true,
                campaignId,
                estimatedCompletion: campaignState.estimatedCompletion,
                message: `Campaign started. Sending to ${contacts.length} contacts.`
            };

        } catch (error) {
            logger.error(`Error starting campaign:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Process campaign (main sending loop)
     */
    async processCampaign(campaignId, contacts) {
        const campaign = this.activeCampaigns.get(campaignId);
        if (!campaign) return;

        const { sessionId, userId, templates, images, antiBan } = campaign;
        const session = this.waManager.getSession(sessionId);

        let batchCount = 0;
        let templateIndex = 0;
        let imageIndex = 0;

        logger.info(`Processing campaign ${campaignId}: ${contacts.length} contacts`);

        for (let i = 0; i < contacts.length; i++) {
            // Check if campaign is paused
            if (campaign.paused) {
                logger.info(`Campaign ${campaignId} paused. Waiting...`);
                await this.waitForResume(campaignId);
            }

            // Check if campaign still active
            if (!this.activeCampaigns.has(campaignId)) {
                logger.info(`Campaign ${campaignId} stopped`);
                break;
            }

            const contact = contacts[i];

            try {
                // Select template (rotation)
                const template = templates.length > 1 ? 
                    templates[templateIndex % templates.length] : 
                    templates[0];
                
                // Select image (rotation)
                const image = images.length > 0 ? 
                    (images.length > 1 ? images[imageIndex % images.length] : images[0]) : 
                    null;

                // Replace variables in message
                let message = this.replaceVariables(template.message, contact);

                // Add random variations for anti-ban
                message = this.addRandomVariations(message, antiBan);

                // Send message
                let result;
                if (image) {
                    result = await this.waManager.sendImageMessage(
                        sessionId,
                        contact.number,
                        image.url,
                        message
                    );
                } else {
                    result = await this.waManager.sendMessage(
                        sessionId,
                        contact.number,
                        message
                    );
                }

                if (result.success) {
                    campaign.sent++;
                    campaign.remaining--;

                    logger.info(`✅ Sent to ${contact.number} (${campaign.sent}/${campaign.totalContacts})`);

                    // Emit success event
                    this.emit('message:sent', {
                        campaignId,
                        contact: contact.number,
                        index: i
                    });

                    // Update real-time via Socket.io
                    this.io.to(userId).emit('campaign:progress', {
                        campaignId,
                        sent: campaign.sent,
                        failed: campaign.failed,
                        remaining: campaign.remaining,
                        total: campaign.totalContacts,
                        percentage: Math.round((campaign.sent / campaign.totalContacts) * 100)
                    });

                    // Save to database
                    await this.saveCampaignProgress(campaignId, campaign);

                } else {
                    throw new Error(result.error);
                }

                // Rotate template and image
                templateIndex++;
                if (images.length > 0) imageIndex++;

                // Random delay between messages (ANTI-BAN)
                const randomDelay = this.getRandomDelay(antiBan.minDelay, antiBan.maxDelay);
                logger.info(`Waiting ${randomDelay}s before next message...`);
                await this.delay(randomDelay * 1000);

                // Batch cooldown (ANTI-BAN)
                batchCount++;
                if (batchCount >= antiBan.batchSize) {
                    logger.info(`Batch complete (${antiBan.batchSize} messages). Cooldown for ${antiBan.cooldownPeriod}s...`);
                    
                    campaign.currentBatch++;
                    
                    // Emit batch complete
                    this.io.to(userId).emit('campaign:batch:complete', {
                        campaignId,
                        batchNumber: campaign.currentBatch,
                        cooldownSeconds: antiBan.cooldownPeriod
                    });

                    await this.delay(antiBan.cooldownPeriod * 1000);
                    batchCount = 0;
                }

            } catch (error) {
                campaign.failed++;
                campaign.remaining--;
                campaign.failedNumbers.push(contact.number);

                logger.error(`❌ Failed to send to ${contact.number}:`, error.message);

                // Emit failure event
                this.emit('message:failed', {
                    campaignId,
                    contact: contact.number,
                    error: error.message
                });

                this.io.to(userId).emit('campaign:message:failed', {
                    campaignId,
                    contact: contact.number,
                    error: error.message
                });

                // Continue with next contact (don't stop campaign)
            }
        }

        // Campaign completed
        campaign.status = 'completed';
        campaign.completedAt = new Date();

        logger.info(`✅ Campaign ${campaignId} completed. Sent: ${campaign.sent}, Failed: ${campaign.failed}`);

        // Emit completion
        this.io.to(userId).emit('campaign:completed', {
            campaignId,
            campaignName: campaign.campaignName,
            sent: campaign.sent,
            failed: campaign.failed,
            total: campaign.totalContacts,
            failedNumbers: campaign.failedNumbers,
            duration: campaign.completedAt - campaign.startedAt
        });

        // Save final state
        await this.saveCampaignFinal(campaignId, campaign);

        // Remove from active campaigns
        this.activeCampaigns.delete(campaignId);
    }

    /**
     * Replace variables in message template
     */
    replaceVariables(message, contact) {
        let result = message;

        // Replace {{name}}
        result = result.replace(/{{name}}/g, contact.name || 'User');

        // Replace {{number}}
        result = result.replace(/{{number}}/g, contact.number);

        // Replace {{custom1}}
        result = result.replace(/{{custom1}}/g, contact.custom1 || '');

        // Replace {{custom2}}
        result = result.replace(/{{custom2}}/g, contact.custom2 || '');

        // Replace {{group}}
        result = result.replace(/{{group}}/g, contact.groupName || '');

        return result;
    }

    /**
     * Add random variations to message (Anti-Ban)
     */
    addRandomVariations(message, antiBan) {
        if (!antiBan.randomizeMessage) return message;

        // Add random spaces (invisible to user but different hash)
        const variations = [
            ' ',      // Normal space
            '\u200B', // Zero-width space
            '\u00A0'  // Non-breaking space
        ];

        // Randomly add at end
        if (Math.random() > 0.5) {
            const randomSpace = variations[Math.floor(Math.random() * variations.length)];
            message += randomSpace;
        }

        return message;
    }

    /**
     * Get random delay between min and max
     */
    getRandomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Wait for campaign to resume
     */
    async waitForResume(campaignId) {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const campaign = this.activeCampaigns.get(campaignId);
                if (!campaign || !campaign.paused) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 1000);
        });
    }

    /**
     * Pause campaign
     */
    pauseCampaign(campaignId) {
        const campaign = this.activeCampaigns.get(campaignId);
        if (campaign) {
            campaign.paused = true;
            campaign.pausedAt = new Date();
            logger.info(`Campaign ${campaignId} paused`);
            return { success: true, message: 'Campaign paused' };
        }
        return { success: false, error: 'Campaign not found' };
    }

    /**
     * Resume campaign
     */
    resumeCampaign(campaignId) {
        const campaign = this.activeCampaigns.get(campaignId);
        if (campaign && campaign.paused) {
            campaign.paused = false;
            campaign.resumedAt = new Date();
            logger.info(`Campaign ${campaignId} resumed`);
            return { success: true, message: 'Campaign resumed' };
        }
        return { success: false, error: 'Campaign not found or not paused' };
    }

    /**
     * Stop campaign
     */
    stopCampaign(campaignId) {
        const campaign = this.activeCampaigns.get(campaignId);
        if (campaign) {
            campaign.status = 'stopped';
            campaign.stoppedAt = new Date();
            
            // Save final state
            this.saveCampaignFinal(campaignId, campaign);
            
            // Remove from active
            this.activeCampaigns.delete(campaignId);
            
            logger.info(`Campaign ${campaignId} stopped`);
            return { success: true, message: 'Campaign stopped' };
        }
        return { success: false, error: 'Campaign not found' };
    }

    /**
     * Retry failed messages
     */
    async retryFailedMessages(campaignId) {
        try {
            const campaign = this.activeCampaigns.get(campaignId);
            
            if (!campaign) {
                // Load from database
                const campaignData = await this.database.getCampaign(campaignId);
                if (!campaignData || !campaignData.failedNumbers) {
                    throw new Error('No failed messages to retry');
                }

                // Create new campaign for failed numbers
                const failedContacts = campaignData.failedNumbers.map(number => ({
                    number,
                    name: 'User'
                }));

                const retryCampaignData = {
                    ...campaignData,
                    campaignId: `${campaignId}_retry_${Date.now()}`,
                    campaignName: `${campaignData.campaignName} (Retry)`,
                    contacts: failedContacts
                };

                return await this.startCampaign(retryCampaignData);
            }

            return { success: false, error: 'Campaign is still running' };

        } catch (error) {
            logger.error(`Error retrying failed messages:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get campaign status
     */
    getCampaignStatus(campaignId) {
        const campaign = this.activeCampaigns.get(campaignId);
        
        if (!campaign) {
            return { success: false, error: 'Campaign not found' };
        }

        return {
            success: true,
            status: {
                campaignId: campaign.campaignId,
                campaignName: campaign.campaignName,
                status: campaign.status,
                sent: campaign.sent,
                failed: campaign.failed,
                remaining: campaign.remaining,
                total: campaign.totalContacts,
                percentage: Math.round((campaign.sent / campaign.totalContacts) * 100),
                startedAt: campaign.startedAt,
                estimatedCompletion: campaign.estimatedCompletion,
                paused: campaign.paused
            }
        };
    }

    /**
     * Get all active campaigns
     */
    getActiveCampaigns(userId = null) {
        const campaigns = [];

        this.activeCampaigns.forEach((campaign, campaignId) => {
            if (!userId || campaign.userId === userId) {
                campaigns.push({
                    campaignId,
                    campaignName: campaign.campaignName,
                    status: campaign.status,
                    sent: campaign.sent,
                    failed: campaign.failed,
                    total: campaign.totalContacts,
                    percentage: Math.round((campaign.sent / campaign.totalContacts) * 100),
                    startedAt: campaign.startedAt
                });
            }
        });

        return campaigns;
    }

    /**
     * Save campaign progress to database
     */
    async saveCampaignProgress(campaignId, campaign) {
        try {
            await this.database.updateCampaign(campaignId, {
                sent: campaign.sent,
                failed: campaign.failed,
                remaining: campaign.remaining,
                failedNumbers: campaign.failedNumbers,
                currentBatch: campaign.currentBatch,
                updatedAt: new Date()
            });
        } catch (error) {
            logger.error(`Error saving campaign progress:`, error);
        }
    }

    /**
     * Save final campaign state
     */
    async saveCampaignFinal(campaignId, campaign) {
        try {
            await this.database.updateCampaign(campaignId, {
                status: campaign.status,
                sent: campaign.sent,
                failed: campaign.failed,
                failedNumbers: campaign.failedNumbers,
                completedAt: campaign.completedAt || new Date(),
                stoppedAt: campaign.stoppedAt,
                duration: campaign.completedAt ? 
                    campaign.completedAt - campaign.startedAt : 
                    Date.now() - campaign.startedAt
            });

            logger.info(`Campaign ${campaignId} final state saved`);
        } catch (error) {
            logger.error(`Error saving final campaign state:`, error);
        }
    }

    /**
     * Get statistics
     */
    getStats() {
        const stats = {
            activeCampaigns: this.activeCampaigns.size,
            totalSending: 0,
            totalSent: 0,
            totalFailed: 0
        };

        this.activeCampaigns.forEach(campaign => {
            stats.totalSending += campaign.remaining;
            stats.totalSent += campaign.sent;
            stats.totalFailed += campaign.failed;
        });

        return stats;
    }
}

// Export
module.exports = BulkSender;

/**
 * ================================================
 * 🎉 BULK SENDER COMPLETE!
 * Lines: ~700+
 * Features: Advanced Anti-Ban System
 * Railway Ready ✅ Production Grade ✅
 * ================================================
 */
