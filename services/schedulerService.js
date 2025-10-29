const cron = require('node-cron');
const Campaign = require('../models/Campaign');
const messageService = require('./messageService');
const moment = require('moment-timezone');

class SchedulerService {
    constructor() {
        this.jobs = new Map();
    }

    // Start all schedulers
    startAll(io) {
        console.log('🕐 Starting all schedulers...');
        
        // Campaign scheduler (runs every minute)
        this.scheduleCampaigns(io);
        
        // Cleanup old sessions (runs daily at 2 AM)
        this.scheduleCleanup();
        
        // Order follow-ups (runs every hour)
        this.scheduleOrderFollowUps(io);
        
        console.log('✅ All schedulers started!');
    }

    // Schedule campaigns
    scheduleCampaigns(io) {
        const job = cron.schedule('* * * * *', async () => {
            try {
                const now = moment().tz('Asia/Kolkata').toDate();
                
                // Find campaigns scheduled for now
                const campaigns = await Campaign.find({
                    scheduleType: 'scheduled',
                    scheduledAt: { $lte: now },
                    status: 'pending'
                }).populate('userId');

                for (const campaign of campaigns) {
                    console.log(`📤 Processing campaign: ${campaign.name}`);
                    
                    // Update status to running
                    campaign.status = 'running';
                    campaign.startedAt = new Date();
                    await campaign.save();

                    // Emit to frontend
                    io.emit('campaign-started', {
                        campaignId: campaign._id,
                        name: campaign.name,
                        userId: campaign.userId._id
                    });

                    // Process campaign in background
                    this.processCampaign(campaign, io).catch(err => {
                        console.error('Campaign processing error:', err);
                    });
                }

            } catch (error) {
                console.error('Campaign scheduler error:', error);
            }
        });

        this.jobs.set('campaigns', job);
    }

    // Process campaign messages
    async processCampaign(campaign, io) {
        try {
            const results = await messageService.sendBulkMessages(
                campaign.contacts,
                campaign.message.text,
                {
                    delay: campaign.antiBan.delayBetweenMessages,
                    randomDelay: campaign.antiBan.randomDelay,
                    mediaUrl: campaign.message.mediaUrl,
                    mediaType: campaign.message.mediaType,
                    onProgress: (sent, total) => {
                        // Emit progress
                        io.emit('campaign-progress', {
                            campaignId: campaign._id,
                            sent,
                            total,
                            progress: ((sent / total) * 100).toFixed(2)
                        });
                    }
                }
            );

            // Update campaign with results
            campaign.contacts = campaign.contacts.map((contact, index) => {
                const result = results[index];
                return {
                    ...contact.toObject(),
                    status: result.status,
                    sentAt: result.status === 'sent' ? new Date() : null,
                    error: result.error
                };
            });

            campaign.status = 'completed';
            campaign.completedAt = new Date();
            await campaign.save();

            // Emit completion
            io.emit('campaign-completed', {
                campaignId: campaign._id,
                name: campaign.name,
                stats: campaign.stats
            });

        } catch (error) {
            campaign.status = 'failed';
            await campaign.save();
            
            io.emit('campaign-failed', {
                campaignId: campaign._id,
                error: error.message
            });
        }
    }

    // Schedule cleanup
    scheduleCleanup() {
        const job = cron.schedule('0 2 * * *', async () => {
            try {
                console.log('🧹 Running cleanup...');
                
                // Delete old sessions (older than 30 days)
                const fs = require('fs');
                const path = require('path');
                const sessionsPath = path.join(__dirname, '../sessions');
                
                if (fs.existsSync(sessionsPath)) {
                    const sessions = fs.readdirSync(sessionsPath);
                    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                    
                    for (const session of sessions) {
                        const sessionPath = path.join(sessionsPath, session);
                        const stats = fs.statSync(sessionPath);
                        
                        if (stats.mtimeMs < thirtyDaysAgo) {
                            fs.rmSync(sessionPath, { recursive: true });
                            console.log(`🗑️  Deleted old session: ${session}`);
                        }
                    }
                }
                
                console.log('✅ Cleanup completed!');
            } catch (error) {
                console.error('Cleanup error:', error);
            }
        });

        this.jobs.set('cleanup', job);
    }

    // Schedule order follow-ups
    scheduleOrderFollowUps(io) {
        const job = cron.schedule('0 * * * *', async () => {
            try {
                const Order = require('../models/Order');
                const whatsappService = require('./whatsappService');
                
                // Find delivered orders from 7 days ago (for feedback)
                const sevenDaysAgo = moment().subtract(7, 'days').startOf('day').toDate();
                
                const orders = await Order.find({
                    status: 'delivered',
                    deliveredAt: {
                        $gte: sevenDaysAgo,
                        $lt: moment(sevenDaysAgo).endOf('day').toDate()
                    },
                    'whatsappMessages.type': { $ne: 'follow_up' }
                });

                for (const order of orders) {
                    const message = `
🙏 *नमस्कार ${order.customer.name} जी!*

आपकी पुस्तक *${order.books[0].bookName}* 7 दिन पहले डिलीवर हुई थी।

आशा है आपको पुस्तक पसंद आई होगी। 📖

कृपया अपना feedback share करें।

धन्यवाद! 🙏
*Sant Rampal Ji Maharaj*`;

                    await whatsappService.sendMessage(
                        order.customer.phone,
                        message.trim()
                    );

                    await order.sendWhatsAppNotification('follow_up', message);
                }

            } catch (error) {
                console.error('Order follow-up error:', error);
            }
        });

        this.jobs.set('order-followups', job);
    }

    // Stop all jobs
    stopAll() {
        this.jobs.forEach((job, name) => {
            job.stop();
            console.log(`⏹️  Stopped scheduler: ${name}`);
        });
        this.jobs.clear();
    }
}

module.exports = new SchedulerService();
