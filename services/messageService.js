/**
 * ═══════════════════════════════════════════════════════════════
 * MESSAGE SERVICE - Complete Bulk Messaging Engine
 * Features: Anti-ban, Percentage-based, Retry, Real-time status
 * ═══════════════════════════════════════════════════════════════
 */

const whatsappService = require('./whatsappService');
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');

// Active campaign jobs
const activeCampaigns = new Map();

/**
 * ═══════════════════════════════════════════════════════════════
 * START CAMPAIGN
 * Main function to start bulk messaging campaign
 * ═══════════════════════════════════════════════════════════════
 */
async function startCampaign(campaignId, userId, options = {}) {
    try {
        console.log(`🚀 Starting campaign ${campaignId}...`);

        // Get campaign details
        const campaign = await Campaign.findById(campaignId)
            .populate('contactList');

        if (!campaign) {
            return { success: false, error: 'Campaign not found' };
        }

        if (campaign.status === 'running') {
            return { success: false, error: 'Campaign already running' };
        }

        // Get user's WhatsApp session
        const User = require('../models/User');
        const user = await User.findById(userId);
        
        const activeSession = user.whatsappSessions.find(s => s.isActive && s.isPrimary);
        if (!activeSession) {
            return { success: false, error: 'No active WhatsApp session found' };
        }

        // Get contacts
        const contacts = await Contact.find({
            _id: { $in: campaign.contactList.contacts }
        });

        if (contacts.length === 0) {
            return { success: false, error: 'No contacts found in campaign' };
        }

        // Update campaign status
        campaign.status = 'running';
        campaign.startedAt = Date.now();
        campaign.stats.totalRecipients = contacts.length;
        await campaign.save();

        // Start sending in background
        const io = options.io;
        sendCampaignMessages(campaign, user, activeSession, contacts, io)
            .catch(err => console.error('Campaign error:', err));

        return {
            success: true,
            message: 'Campaign started successfully',
            campaignId: campaign._id,
            totalRecipients: contacts.length
        };

    } catch (error) {
        console.error('❌ Failed to start campaign:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * SEND CAMPAIGN MESSAGES
 * Background job to send all messages
 * ═══════════════════════════════════════════════════════════════
 */
async function sendCampaignMessages(campaign, user, session, contacts, io) {
    try {
        const campaignId = campaign._id.toString();
        
        // Store active campaign
        activeCampaigns.set(campaignId, {
            status: 'running',
            startTime: Date.now(),
            paused: false
        });

        // Get campaign settings
        const settings = campaign.deliverySettings || {};
        const minDelay = settings.minDelay || 3000;  // 3 seconds
        const maxDelay = settings.maxDelay || 10000; // 10 seconds
        const batchSize = settings.batchSize || 20;
        const cooldown = settings.cooldownPeriod || 60000; // 1 minute

        // Calculate daily percentage sending
        const dailyPercentage = settings.dailyPercentage || 100;
        const contactsToday = Math.ceil((contacts.length * dailyPercentage) / 100);
        const contactsToSend = contacts.slice(0, contactsToday);

        console.log(`📊 Campaign ${campaignId}: Sending to ${contactsToSend.length}/${contacts.length} contacts (${dailyPercentage}%)`);

        // Emit start event
        if (io) {
            io.to(`user_${user._id}`).emit('campaign:started', {
                campaignId,
                total: contactsToSend.length,
                percentage: dailyPercentage
            });
        }

        let sent = 0;
        let failed = 0;
        const failedContacts = [];

        // Process in batches
        for (let i = 0; i < contactsToSend.length; i += batchSize) {
            // Check if campaign is paused
            const campaignJob = activeCampaigns.get(campaignId);
            if (campaignJob && campaignJob.paused) {
                console.log(`⏸️  Campaign ${campaignId} paused`);
                break;
            }

            const batch = contactsToSend.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(contactsToSend.length / batchSize);

            console.log(`📦 Batch ${batchNum}/${totalBatches}: ${batch.length} messages`);

            // Emit batch start
            if (io) {
                io.to(`user_${user._id}`).emit('campaign:batch', {
                    campaignId,
                    batchNum,
                    totalBatches,
                    batchSize: batch.length
                });
            }

            // Send messages in batch
            for (const contact of batch) {
                try {
                    // Random anti-ban delay
                    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
                    await sleep(delay);

                    // Replace variables in message
                    const personalizedMessage = replaceVariables(campaign.message, contact);

                    // Send message
                    const result = await whatsappService.sendMessage(
                        user._id,
                        session.sessionId,
                        contact.phone,
                        personalizedMessage
                    );

                    if (result.success) {
                        sent++;
                        
                        // Update contact delivery status
                        contact.lastMessageStatus = 'delivered';
                        contact.lastMessageDate = Date.now();
                        await contact.save();

                        // Emit success (GREEN)
                        if (io) {
                            io.to(`user_${user._id}`).emit('campaign:message:sent', {
                                campaignId,
                                contact: {
                                    id: contact._id,
                                    name: contact.name,
                                    phone: contact.phone
                                },
                                status: 'success',
                                color: 'green',
                                progress: {
                                    sent,
                                    failed,
                                    total: contactsToSend.length,
                                    percentage: Math.round((sent / contactsToSend.length) * 100)
                                }
                            });
                        }

                    } else {
                        failed++;
                        failedContacts.push({
                            contact: contact._id,
                            phone: contact.phone,
                            name: contact.name,
                            error: result.error,
                            attemptedAt: Date.now()
                        });

                        // Update contact status
                        contact.lastMessageStatus = 'failed';
                        await contact.save();

                        // Emit failure (RED)
                        if (io) {
                            io.to(`user_${user._id}`).emit('campaign:message:failed', {
                                campaignId,
                                contact: {
                                    id: contact._id,
                                    name: contact.name,
                                    phone: contact.phone
                                },
                                error: result.error,
                                status: 'failed',
                                color: 'red',
                                progress: {
                                    sent,
                                    failed,
                                    total: contactsToSend.length,
                                    percentage: Math.round((sent / contactsToSend.length) * 100)
                                }
                            });
                        }
                    }

                } catch (error) {
                    failed++;
                    failedContacts.push({
                        contact: contact._id,
                        phone: contact.phone,
                        name: contact.name,
                        error: error.message,
                        attemptedAt: Date.now()
                    });

                    console.error(`❌ Failed to send to ${contact.phone}:`, error.message);
                }
            }

            // Cooldown between batches (except last batch)
            if (i + batchSize < contactsToSend.length) {
                console.log(`⏳ Cooldown: ${cooldown/1000}s...`);
                
                // Emit cooldown (YELLOW)
                if (io) {
                    io.to(`user_${user._id}`).emit('campaign:cooldown', {
                        campaignId,
                        duration: cooldown,
                        color: 'yellow'
                    });
                }

                await sleep(cooldown);
            }
        }

        // Campaign completed
        campaign.status = 'completed';
        campaign.completedAt = Date.now();
        campaign.stats.sent = sent;
        campaign.stats.failed = failed;
        campaign.stats.deliveryRate = Math.round((sent / contactsToSend.length) * 100);
        campaign.failedDeliveries = failedContacts;
        await campaign.save();

        // Remove from active campaigns
        activeCampaigns.delete(campaignId);

        // Emit completion
        if (io) {
            io.to(`user_${user._id}`).emit('campaign:completed', {
                campaignId,
                stats: {
                    total: contactsToSend.length,
                    sent,
                    failed,
                    deliveryRate: campaign.stats.deliveryRate
                },
                failedContacts: failedContacts.length
            });
        }

        console.log(`✅ Campaign ${campaignId} completed: ${sent} sent, ${failed} failed`);

        return { success: true, sent, failed };

    } catch (error) {
        console.error('❌ Campaign sending error:', error);
        
        // Update campaign status
        campaign.status = 'failed';
        campaign.error = error.message;
        await campaign.save();

        activeCampaigns.delete(campaign._id.toString());

        return { success: false, error: error.message };
    }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * REPLACE VARIABLES IN MESSAGE
 * Replace {{name}}, {{phone}}, etc. with actual values
 * ═══════════════════════════════════════════════════════════════
 */
function replaceVariables(message, contact) {
    let personalizedMessage = message;
    
    // Replace common variables
    personalizedMessage = personalizedMessage.replace(/\{\{name\}\}/gi, contact.name || 'Customer');
    personalizedMessage = personalizedMessage.replace(/\{\{phone\}\}/gi, contact.phone || '');
    personalizedMessage = personalizedMessage.replace(/\{\{email\}\}/gi, contact.email || '');
    personalizedMessage = personalizedMessage.replace(/\{\{company\}\}/gi, contact.company || '');
    
    // Custom fields
    if (contact.customFields) {
        for (const [key, value] of Object.entries(contact.customFields)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
            personalizedMessage = personalizedMessage.replace(regex, value || '');
        }
    }

    return personalizedMessage;
}

/**
 * ═══════════════════════════════════════════════════════════════
 * HELPER: SLEEP
 * ═══════════════════════════════════════════════════════════════
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * ═══════════════════════════════════════════════════════════════
 * MESSAGE SERVICE - PART 2: Retry & Control Functions
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * ═══════════════════════════════════════════════════════════════
 * RETRY FAILED MESSAGES
 * Retry sending to all failed contacts
 * ═══════════════════════════════════════════════════════════════
 */
async function retryFailedMessages(campaignId, userId, options = {}) {
    try {
        console.log(`🔄 Retrying failed messages for campaign ${campaignId}...`);

        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return { success: false, error: 'Campaign not found' };
        }

        if (campaign.failedDeliveries.length === 0) {
            return { success: false, error: 'No failed messages to retry' };
        }

        // Get user session
        const User = require('../models/User');
        const user = await User.findById(userId);
        const activeSession = user.whatsappSessions.find(s => s.isActive && s.isPrimary);

        if (!activeSession) {
            return { success: false, error: 'No active WhatsApp session' };
        }

        // Get failed contacts
        const failedContactIds = campaign.failedDeliveries.map(f => f.contact);
        const failedContacts = await Contact.find({ _id: { $in: failedContactIds } });

        const io = options.io;
        let retrySent = 0;
        let retryFailed = 0;
        const stillFailed = [];

        // Emit retry start
        if (io) {
            io.to(`user_${userId}`).emit('campaign:retry:started', {
                campaignId,
                total: failedContacts.length
            });
        }

        // Retry each failed contact
        for (const contact of failedContacts) {
            try {
                // Random delay
                const delay = Math.floor(Math.random() * 7000) + 3000;
                await sleep(delay);

                const personalizedMessage = replaceVariables(campaign.message, contact);

                const result = await whatsappService.sendMessage(
                    userId,
                    activeSession.sessionId,
                    contact.phone,
                    personalizedMessage
                );

                if (result.success) {
                    retrySent++;
                    
                    contact.lastMessageStatus = 'delivered';
                    contact.lastMessageDate = Date.now();
                    await contact.save();

                    // Emit success
                    if (io) {
                        io.to(`user_${userId}`).emit('campaign:retry:sent', {
                            campaignId,
                            contact: { id: contact._id, name: contact.name, phone: contact.phone },
                            color: 'green'
                        });
                    }

                } else {
                    retryFailed++;
                    stillFailed.push({
                        contact: contact._id,
                        phone: contact.phone,
                        name: contact.name,
                        error: result.error,
                        attemptedAt: Date.now()
                    });

                    // Emit failure
                    if (io) {
                        io.to(`user_${userId}`).emit('campaign:retry:failed', {
                            campaignId,
                            contact: { id: contact._id, name: contact.name, phone: contact.phone },
                            error: result.error,
                            color: 'red'
                        });
                    }
                }

            } catch (error) {
                retryFailed++;
                stillFailed.push({
                    contact: contact._id,
                    phone: contact.phone,
                    name: contact.name,
                    error: error.message,
                    attemptedAt: Date.now()
                });
            }
        }

        // Update campaign
        campaign.stats.sent += retrySent;
        campaign.stats.failed = stillFailed.length;
        campaign.failedDeliveries = stillFailed;
        campaign.stats.deliveryRate = Math.round((campaign.stats.sent / campaign.stats.totalRecipients) * 100);
        await campaign.save();

        // Emit completion
        if (io) {
            io.to(`user_${userId}`).emit('campaign:retry:completed', {
                campaignId,
                retrySent,
                retryFailed,
                newDeliveryRate: campaign.stats.deliveryRate
            });
        }

        console.log(`✅ Retry completed: ${retrySent} sent, ${retryFailed} still failed`);

        return {
            success: true,
            retrySent,
            retryFailed,
            deliveryRate: campaign.stats.deliveryRate
        };

    } catch (error) {
        console.error('❌ Retry failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * PAUSE CAMPAIGN
 * ═══════════════════════════════════════════════════════════════
 */
async function pauseCampaign(campaignId) {
    try {
        const campaignJob = activeCampaigns.get(campaignId);
        if (campaignJob) {
            campaignJob.paused = true;
        }

        const campaign = await Campaign.findById(campaignId);
        if (campaign) {
            campaign.status = 'paused';
            await campaign.save();
        }

        return { success: true, message: 'Campaign paused' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * RESUME CAMPAIGN
 * ═══════════════════════════════════════════════════════════════
 */
async function resumeCampaign(campaignId, userId, options = {}) {
    try {
        const campaignJob = activeCampaigns.get(campaignId);
        if (campaignJob) {
            campaignJob.paused = false;
        }

        const campaign = await Campaign.findById(campaignId);
        if (campaign) {
            campaign.status = 'running';
            await campaign.save();
        }

        // If campaign was stopped, restart it
        if (!campaignJob) {
            return await startCampaign(campaignId, userId, options);
        }

        return { success: true, message: 'Campaign resumed' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * CANCEL CAMPAIGN
 * ═══════════════════════════════════════════════════════════════
 */
async function cancelCampaign(campaignId) {
    try {
        activeCampaigns.delete(campaignId);

        const campaign = await Campaign.findById(campaignId);
        if (campaign) {
            campaign.status = 'cancelled';
            campaign.completedAt = Date.now();
            await campaign.save();
        }

        return { success: true, message: 'Campaign cancelled' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * GET CAMPAIGN STATS
 * ═══════════════════════════════════════════════════════════════
 */
async function getCampaignStats(campaignId) {
    try {
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return { success: false, error: 'Campaign not found' };
        }

        const isActive = activeCampaigns.has(campaignId);

        return {
            success: true,
            stats: {
                status: campaign.status,
                isActive,
                totalRecipients: campaign.stats.totalRecipients,
                sent: campaign.stats.sent,
                failed: campaign.stats.failed,
                deliveryRate: campaign.stats.deliveryRate,
                startedAt: campaign.startedAt,
                completedAt: campaign.completedAt,
                failedCount: campaign.failedDeliveries.length
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * EXPORTS
 * ═══════════════════════════════════════════════════════════════
 */
module.exports = {
    startCampaign,
    pauseCampaign,
    resumeCampaign,
    cancelCampaign,
    retryFailedMessages,
    getCampaignStats,
    activeCampaigns
};

