const cron = require('node-cron');
const Campaign = require('../models/Campaign');

const startScheduler = (io) => {
    // Check every minute for scheduled campaigns
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            
            const campaigns = await Campaign.find({
                scheduleType: 'scheduled',
                scheduledAt: { $lte: now },
                status: 'pending'
            });
            
            for (const campaign of campaigns) {
                campaign.status = 'running';
                await campaign.save();
                
                // Emit to frontend
                io.emit('campaign-started', {
                    campaignId: campaign._id,
                    name: campaign.name
                });
                
                // Process campaign (send messages)
                await processCampaign(campaign, io);
            }
        } catch (error) {
            console.error('Scheduler Error:', error);
        }
    });
    
    console.log('✅ Scheduler started');
};

const processCampaign = async (campaign, io) => {
    for (let i = 0; i < campaign.contacts.length; i++) {
        const contact = campaign.contacts[i];
        
        try {
            // Simulate sending (replace with actual WhatsApp send)
            await new Promise(resolve => setTimeout(resolve, campaign.delayBetweenMessages));
            
            contact.status = 'sent';
            contact.sentAt = new Date();
            campaign.sentCount++;
            
            // Emit progress
            io.emit('campaign-progress', {
                campaignId: campaign._id,
                progress: ((i + 1) / campaign.contacts.length * 100).toFixed(2),
                sentCount: campaign.sentCount
            });
            
        } catch (error) {
            contact.status = 'failed';
            contact.error = error.message;
            campaign.failedCount++;
        }
        
        await campaign.save();
    }
    
    campaign.status = 'completed';
    campaign.completedAt = new Date();
    await campaign.save();
    
    io.emit('campaign-completed', {
        campaignId: campaign._id,
        sentCount: campaign.sentCount,
        failedCount: campaign.failedCount
    });
};

module.exports = { startScheduler };
