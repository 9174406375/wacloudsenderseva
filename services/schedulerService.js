/**
 * ═══════════════════════════════════════════════════════════════
 * SCHEDULER SERVICE - Campaign Scheduling & Automation
 * Auto-start scheduled campaigns, quota reset, auto-retry
 * ═══════════════════════════════════════════════════════════════
 */

const cron = require('node-cron');
const messageService = require('./messageService');
const Campaign = require('../models/Campaign');
const User = require('../models/User');

// Scheduled jobs storage
const scheduledJobs = new Map();

/**
 * ═══════════════════════════════════════════════════════════════
 * INITIALIZE SCHEDULER
 * Start all cron jobs
 * ═══════════════════════════════════════════════════════════════
 */
function initializeScheduler(io) {
    console.log('🕐 Initializing scheduler...');

    // Check for scheduled campaigns every minute
    const campaignCheckJob = cron.schedule('* * * * *', async () => {
        await checkScheduledCampaigns(io);
    });

    // Reset daily quotas at midnight
    const quotaResetJob = cron.schedule('0 0 * * *', async () => {
        await resetDailyQuotas();
    });

    // Auto-retry failed messages every 6 hours
    const autoRetryJob = cron.schedule('0 */6 * * *', async () => {
        await autoRetryFailedCampaigns(io);
    });

    scheduledJobs.set('campaignCheck', campaignCheckJob);
    scheduledJobs.set('quotaReset', quotaResetJob);
    scheduledJobs.set('autoRetry', autoRetryJob);

    console.log('✅ Scheduler initialized');
}

/**
 * ═══════════════════════════════════════════════════════════════
 * CHECK SCHEDULED CAMPAIGNS
 * Start campaigns that are scheduled for current time
 * ═══════════════════════════════════════════════════════════════
 */
async function checkScheduledCampaigns(io) {
    try {
        const now = Date.now();
        
        // Find campaigns scheduled for now
        const scheduledCampaigns = await Campaign.find({
            status: 'scheduled',
            scheduledFor: { $lte: now }
        }).populate('user');

        for (const campaign of scheduledCampaigns) {
            console.log(`🚀 Auto-starting scheduled campaign: ${campaign.name}`);
            
            await messageService.startCampaign(
                campaign._id,
                campaign.user._id,
                { io }
            );
        }

    } catch (error) {
        console.error('❌ Error checking scheduled campaigns:', error);
    }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * RESET DAILY QUOTAS
 * Reset user message quotas at midnight
 * ═══════════════════════════════════════════════════════════════
 */
async function resetDailyQuotas() {
    try {
        console.log('🔄 Resetting daily message quotas...');
        
        const users = await User.find({
            'subscription.status': 'active'
        });

        for (const user of users) {
            user.usage.messagesUsed = 0;
            user.usage.lastResetDate = Date.now();
            await user.save();
        }

        console.log(`✅ Reset quotas for ${users.length} users`);

    } catch (error) {
        console.error('❌ Error resetting quotas:', error);
    }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * AUTO-RETRY FAILED CAMPAIGNS
 * Automatically retry failed messages every 6 hours
 * ═══════════════════════════════════════════════════════════════
 */
async function autoRetryFailedCampaigns(io) {
    try {
        console.log('🔄 Auto-retrying failed campaigns...');

        const failedCampaigns = await Campaign.find({
            status: 'completed',
            'stats.failed': { $gt: 0 },
            'failedDeliveries.0': { $exists: true }
        }).limit(10);

        for (const campaign of failedCampaigns) {
            console.log(`🔄 Retrying campaign: ${campaign.name}`);
            
            await messageService.retryFailedMessages(
                campaign._id,
                campaign.user,
                { io }
            );
        }

    } catch (error) {
        console.error('❌ Error auto-retrying:', error);
    }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * SCHEDULE CAMPAIGN
 * Schedule a campaign for future execution
 * ═══════════════════════════════════════════════════════════════
 */
async function scheduleCampaign(campaignId, scheduleTime) {
    try {
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return { success: false, error: 'Campaign not found' };
        }

        campaign.scheduledFor = scheduleTime;
        campaign.status = 'scheduled';
        await campaign.save();

        return {
            success: true,
            message: 'Campaign scheduled successfully',
            scheduledFor: scheduleTime
        };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * STOP ALL JOBS
 * ═══════════════════════════════════════════════════════════════
 */
function stopAllJobs() {
    for (const [name, job] of scheduledJobs.entries()) {
        job.stop();
        console.log(`⏹️  Stopped job: ${name}`);
    }
    scheduledJobs.clear();
}

module.exports = {
    initializeScheduler,
    scheduleCampaign,
    stopAllJobs,
    checkScheduledCampaigns,
    resetDailyQuotas,
    autoRetryFailedCampaigns
};
