const whatsappClient = require('./whatsapp');
const db = require('./database');
const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parser');
const createReadStream = require('fs').createReadStream;
const EventEmitter = require('events');

class BulkSender extends EventEmitter {
    constructor() {
        super();
        this.campaigns = new Map();
        this.activeCampaign = null;
        this.isPaused = false;
        this.isStopped = false;
        this.dailyMessageCount = 0;
        this.dailyLimit = 1000; // WhatsApp safety limit
        this.lastResetDate = new Date().toDateString();
    }

    // Create new campaign
    async createCampaign(name, message, phoneNumbers, mediaPath = null, delay = 3000) {
        try {
            const campaignId = Date.now().toString();
            
            // Save campaign to database
            await db.run(`
                INSERT INTO campaigns (id, name, message, total_recipients, status, delay, media_path, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [campaignId, name, message, phoneNumbers.length, 'created', delay, mediaPath, new Date().toISOString()]);

            // Save recipients
            for (const phone of phoneNumbers) {
                await db.run(`
                    INSERT INTO campaign_recipients (campaign_id, phone_number, status)
                    VALUES (?, ?, ?)
                `, [campaignId, phone, 'pending']);
            }

            const campaign = {
                id: campaignId,
                name: name,
                message: message,
                phoneNumbers: phoneNumbers,
                mediaPath: mediaPath,
                delay: delay,
                status: 'created',
                totalRecipients: phoneNumbers.length,
                sentCount: 0,
                failedCount: 0,
                pendingCount: phoneNumbers.length,
                currentIndex: 0,
                createdAt: new Date()
            };

            this.campaigns.set(campaignId, campaign);

            console.log(`✅ Campaign "${name}" created with ${phoneNumbers.length} recipients`);
            
            return {
                success: true,
                campaignId: campaignId,
                campaign: campaign
            };

        } catch (error) {
            console.error('❌ Error creating campaign:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Start campaign
    async startCampaign(campaignId) {
        const campaign = this.campaigns.get(campaignId);
        
        if (!campaign) {
            throw new Error('Campaign not found');
        }

        if (!whatsappClient.isReady) {
            throw new Error('WhatsApp client not ready. Please connect first.');
        }

        if (this.activeCampaign) {
            throw new Error('Another campaign is already running');
        }

        // Check daily limit
        this.checkDailyLimit();

        campaign.status = 'running';
        this.activeCampaign = campaignId;
        this.isPaused = false;
        this.isStopped = false;

        // Update database
        await db.run(`
            UPDATE campaigns SET status = ?, started_at = ? WHERE id = ?
        `, ['running', new Date().toISOString(), campaignId]);

        console.log(`🚀 Starting campaign: ${campaign.name}`);
        
        this.emit('campaign_started', {
            campaignId: campaignId,
            name: campaign.name,
            totalRecipients: campaign.totalRecipients
        });

        // Start sending messages
        await this.processCampaign(campaign);
    }

    // Process campaign (main sending loop)
    async processCampaign(campaign) {
        const phoneNumbers = campaign.phoneNumbers;
        const startIndex = campaign.currentIndex;

        for (let i = startIndex; i < phoneNumbers.length; i++) {
            // Check if stopped
            if (this.isStopped) {
                campaign.status = 'stopped';
                await this.updateCampaignStatus(campaign.id, 'stopped');
                this.emit('campaign_stopped', { campaignId: campaign.id });
                break;
            }

            // Check if paused
            while (this.isPaused && !this.isStopped) {
                await this.sleep(1000);
            }

            // Check daily limit
            if (this.dailyMessageCount >= this.dailyLimit) {
                console.log('⚠️ Daily limit reached. Pausing campaign.');
                await this.pauseCampaign(campaign.id);
                this.emit('daily_limit_reached', { campaignId: campaign.id });
                break;
            }

            const phoneNumber = phoneNumbers[i];
            campaign.currentIndex = i;

            try {
                // Send message
                const result = await whatsappClient.sendMessage(
                    phoneNumber,
                    campaign.message,
                    campaign.mediaPath,
                    campaign.delay
                );

                if (result.success) {
                    campaign.sentCount++;
                    campaign.pendingCount--;
                    this.dailyMessageCount++;

                    // Update recipient status
                    await db.run(`
                        UPDATE campaign_recipients 
                        SET status = ?, sent_at = ? 
                        WHERE campaign_id = ? AND phone_number = ?
                    `, ['sent', new Date().toISOString(), campaign.id, phoneNumber]);

                    console.log(`✅ [${campaign.sentCount}/${campaign.totalRecipients}] Sent to ${phoneNumber}`);

                } else {
                    campaign.failedCount++;
                    campaign.pendingCount--;

                    // Update recipient status with error
                    await db.run(`
                        UPDATE campaign_recipients 
                        SET status = ?, error_message = ?, sent_at = ? 
                        WHERE campaign_id = ? AND phone_number = ?
                    `, ['failed', result.error, new Date().toISOString(), campaign.id, phoneNumber]);

                    console.log(`❌ Failed to send to ${phoneNumber}: ${result.error}`);
                }

                // Emit progress update
                this.emit('progress', {
                    campaignId: campaign.id,
                    currentIndex: i + 1,
                    totalRecipients: campaign.totalRecipients,
                    sentCount: campaign.sentCount,
                    failedCount: campaign.failedCount,
                    pendingCount: campaign.pendingCount,
                    percentage: Math.round(((i + 1) / campaign.totalRecipients) * 100)
                });

                // Update campaign stats in database
                await db.run(`
                    UPDATE campaigns 
                    SET sent_count = ?, failed_count = ?, pending_count = ? 
                    WHERE id = ?
                `, [campaign.sentCount, campaign.failedCount, campaign.pendingCount, campaign.id]);

            } catch (error) {
                console.error(`❌ Error sending to ${phoneNumber}:`, error);
                campaign.failedCount++;
                campaign.pendingCount--;
            }

            // Add extra delay to prevent spam detection
            await this.sleep(campaign.delay);
        }

        // Campaign completed
        if (campaign.currentIndex >= phoneNumbers.length - 1 && !this.isStopped) {
            campaign.status = 'completed';
            await this.updateCampaignStatus(campaign.id, 'completed');
            
            this.emit('campaign_completed', {
                campaignId: campaign.id,
                name: campaign.name,
                sentCount: campaign.sentCount,
                failedCount: campaign.failedCount,
                totalRecipients: campaign.totalRecipients
            });

            console.log(`✅ Campaign "${campaign.name}" completed!`);
            console.log(`📊 Sent: ${campaign.sentCount} | Failed: ${campaign.failedCount}`);
        }

        this.activeCampaign = null;
    }

    // Pause campaign
    async pauseCampaign(campaignId) {
        const campaign = this.campaigns.get(campaignId);
        
        if (!campaign || campaign.status !== 'running') {
            throw new Error('Campaign is not running');
        }

        this.isPaused = true;
        campaign.status = 'paused';
        
        await this.updateCampaignStatus(campaignId, 'paused');
        
        this.emit('campaign_paused', { campaignId: campaignId });
        console.log(`⏸️ Campaign "${campaign.name}" paused`);
    }

    // Resume campaign
    async resumeCampaign(campaignId) {
        const campaign = this.campaigns.get(campaignId);
        
        if (!campaign || campaign.status !== 'paused') {
            throw new Error('Campaign is not paused');
        }

        this.isPaused = false;
        campaign.status = 'running';
        
        await this.updateCampaignStatus(campaignId, 'running');
        
        this.emit('campaign_resumed', { campaignId: campaignId });
        console.log(`▶️ Campaign "${campaign.name}" resumed`);
    }

    // Stop campaign
    async stopCampaign(campaignId) {
        const campaign = this.campaigns.get(campaignId);
        
        if (!campaign) {
            throw new Error('Campaign not found');
        }

        this.isStopped = true;
        this.isPaused = false;
        campaign.status = 'stopped';
        
        await this.updateCampaignStatus(campaignId, 'stopped');
        
        this.emit('campaign_stopped', { campaignId: campaignId });
        console.log(`⏹️ Campaign "${campaign.name}" stopped`);
        
        this.activeCampaign = null;
    }

    // Parse CSV file
    async parseCSVFile(filePath) {
        return new Promise((resolve, reject) => {
            const phoneNumbers = [];
            
            createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    // Try to find phone number in row (flexible column names)
                    const phone = row.phone || row.Phone || row.number || row.Number || 
                                 row.mobile || row.Mobile || row.whatsapp || row.WhatsApp ||
                                 Object.values(row)[0]; // fallback to first column
                    
                    if (phone) {
                        phoneNumbers.push(phone.toString().trim());
                    }
                })
                .on('end', () => {
                    console.log(`✅ Parsed ${phoneNumbers.length} phone numbers from CSV`);
                    resolve(phoneNumbers);
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    }

    // Get campaign status
    getCampaignStatus(campaignId) {
        const campaign = this.campaigns.get(campaignId);
        
        if (!campaign) {
            return null;
        }

        return {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            totalRecipients: campaign.totalRecipients,
            sentCount: campaign.sentCount,
            failedCount: campaign.failedCount,
            pendingCount: campaign.pendingCount,
            currentIndex: campaign.currentIndex,
            progress: Math.round((campaign.sentCount / campaign.totalRecipients) * 100),
            isPaused: this.isPaused,
            createdAt: campaign.createdAt
        };
    }

    // Get all campaigns
    async getAllCampaigns() {
        const rows = await db.all(`
            SELECT * FROM campaigns ORDER BY created_at DESC
        `);
        return rows;
    }

    // Update campaign status in database
    async updateCampaignStatus(campaignId, status) {
        await db.run(`
            UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?
        `, [status, new Date().toISOString(), campaignId]);
    }

    // Check and reset daily limit
    checkDailyLimit() {
        const today = new Date().toDateString();
        
        if (this.lastResetDate !== today) {
            this.dailyMessageCount = 0;
            this.lastResetDate = today;
            console.log('✅ Daily message count reset');
        }
    }

    // Sleep helper
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Get daily stats
    getDailyStats() {
        return {
            messagesSentToday: this.dailyMessageCount,
            dailyLimit: this.dailyLimit,
            remainingToday: this.dailyLimit - this.dailyMessageCount,
            percentage: Math.round((this.dailyMessageCount / this.dailyLimit) * 100)
        };
    }
}

module.exports = new BulkSender();
