// ===== GLOBAL VARIABLES =====
let socket;
let currentCampaignId = null;
let qrCodeInstance = null;

// ===== INITIALIZE SOCKET.IO =====
function initializeSocket() {
    socket = io();
    
    // Connection events
    socket.on('connect', () => {
        console.log('✅ Connected to server');
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Disconnected from server');
    });
    
    // WhatsApp events
    socket.on('whatsapp_status', handleWhatsAppStatus);
    socket.on('whatsapp_qr', handleQRCode);
    socket.on('whatsapp_pairing_code', handlePairingCode);
    socket.on('whatsapp_connected', handleWhatsAppConnected);
    socket.on('whatsapp_disconnected', handleWhatsAppDisconnected);
    socket.on('whatsapp_logged_out', handleWhatsAppLoggedOut);
    socket.on('whatsapp_loading', handleWhatsAppLoading);
    
    // Campaign events
    socket.on('campaign_started', handleCampaignStarted);
    socket.on('campaign_progress', handleCampaignProgress);
    socket.on('campaign_completed', handleCampaignCompleted);
    socket.on('campaign_paused', handleCampaignPaused);
    socket.on('campaign_resumed', handleCampaignResumed);
    socket.on('campaign_stopped', handleCampaignStopped);
    socket.on('daily_limit_reached', handleDailyLimitReached);
    
    // Notification event
    socket.on('notification', handleNotification);
}

// ===== TOAST NOTIFICATION SYSTEM =====
function showToast(message, type = 'info', title = null) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const titles = {
        success: title || 'Success',
        error: title || 'Error',
        warning: title || 'Warning',
        info: title || 'Information'
    };
    
    toast.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <div class="toast-content">
            <div class="toast-title">${titles[type]}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ===== LOADING OVERLAY =====
function showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        const text = document.getElementById('loadingText');
        if (text) text.textContent = message;
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function updateLoadingProgress(percent) {
    const fill = document.getElementById('progressFill');
    const text = document.getElementById('loadingPercent');
    if (fill) fill.style.width = percent + '%';
    if (text) text.textContent = percent + '%';
}

// ===== WHATSAPP EVENT HANDLERS =====
function handleWhatsAppStatus(status) {
    console.log('WhatsApp Status:', status);
}

function handleQRCode(data) {
    console.log('QR Code received');
    hideLoading();
    
    const qrPlaceholder = document.getElementById('qrPlaceholder');
    const qrCanvas = document.getElementById('qrCanvas');
    
    if (qrPlaceholder && qrCanvas) {
        qrPlaceholder.style.display = 'none';
        qrCanvas.style.display = 'block';
        
        // Generate QR Code
        if (qrCodeInstance) {
            qrCodeInstance.clear();
        }
        
        qrCodeInstance = new QRCode(qrCanvas, {
            text: data.qr,
            width: 256,
            height: 256,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }
    
    showToast('QR Code generated! Please scan with WhatsApp', 'info');
}

function handlePairingCode(data) {
    console.log('Pairing Code:', data.code);
    hideLoading();
    
    const display = document.getElementById('pairingCodeDisplay');
    const code = document.getElementById('pairingCode');
    
    if (display && code) {
        display.style.display = 'block';
        code.textContent = data.code;
    }
    
    showToast(`Your pairing code: ${data.code}`, 'success', 'Pairing Code Ready');
}

function handleWhatsAppConnected(data) {
    console.log('WhatsApp connected:', data);
    hideLoading();
    
    showToast(`Connected as +${data.number}`, 'success', 'WhatsApp Connected');
    
    // Show connected state
    const connectionCard = document.getElementById('connectionCard');
    const connectedCard = document.getElementById('connectedCard');
    
    if (connectionCard) connectionCard.style.display = 'none';
    if (connectedCard) {
        connectedCard.style.display = 'block';
        const info = document.getElementById('connectedInfo');
        if (info) info.textContent = `Connected as: ${data.name} (+${data.number})`;
    }
    
    updateConnectionStatus('connected', 'Connected');
}

function handleWhatsAppDisconnected(data) {
    console.log('WhatsApp disconnected:', data);
    showToast('WhatsApp disconnected! Please reconnect.', 'warning', 'Disconnected');
    updateConnectionStatus('disconnected', 'Disconnected');
}

function handleWhatsAppLoggedOut(data) {
    console.log('WhatsApp logged out:', data);
    showToast('Successfully logged out from WhatsApp', 'info', 'Logged Out');
    updateConnectionStatus('disconnected', 'Disconnected');
    
    // Redirect to home after 2 seconds
    setTimeout(() => {
        window.location.href = '/';
    }, 2000);
}

function handleWhatsAppLoading(data) {
    updateLoadingProgress(data.percent);
}

function updateConnectionStatus(status, text) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    
    if (statusDot) {
        statusDot.className = 'status-dot ' + status;
    }
    if (statusText) {
        statusText.textContent = text;
    }
}

// ===== CAMPAIGN EVENT HANDLERS =====
function handleCampaignStarted(data) {
    console.log('Campaign started:', data);
    showToast(`Campaign "${data.name}" started with ${data.totalRecipients} recipients`, 'success', 'Campaign Started');
}

function handleCampaignProgress(data) {
    console.log('Campaign progress:', data);
    
    // Update progress modal if open
    const progressModal = document.getElementById('progressModal');
    if (progressModal && progressModal.style.display !== 'none') {
        updateProgressModal(data);
    }
}

function handleCampaignCompleted(data) {
    console.log('Campaign completed:', data);
    showToast(`Campaign completed! Sent: ${data.sentCount}, Failed: ${data.failedCount}`, 'success', 'Campaign Completed');
    
    // Update progress modal
    if (document.getElementById('progressModal')) {
        const pauseBtn = document.getElementById('pauseBtn');
        const stopBtn = document.getElementById('stopBtn');
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'none';
    }
}

function handleCampaignPaused(data) {
    console.log('Campaign paused:', data);
    showToast('Campaign paused', 'warning', 'Paused');
    
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    if (pauseBtn) pauseBtn.style.display = 'none';
    if (resumeBtn) resumeBtn.style.display = 'inline-flex';
}

function handleCampaignResumed(data) {
    console.log('Campaign resumed:', data);
    showToast('Campaign resumed', 'success', 'Resumed');
    
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    if (pauseBtn) pauseBtn.style.display = 'inline-flex';
    if (resumeBtn) resumeBtn.style.display = 'none';
}

function handleCampaignStopped(data) {
    console.log('Campaign stopped:', data);
    showToast('Campaign stopped', 'warning', 'Stopped');
}

function handleDailyLimitReached(data) {
    console.log('Daily limit reached:', data);
    showToast('Daily message limit reached. Campaign paused for safety.', 'warning', 'Limit Reached');
}

function handleNotification(data) {
    console.log('Notification:', data);
    showToast(data.message, data.type, data.title);
}

// ===== PROGRESS MODAL UPDATE =====
function updateProgressModal(data) {
    const progressBarFill = document.getElementById('progressBarFill');
    const progressPercentage = document.getElementById('progressPercentage');
    const progressSent = document.getElementById('progressSent');
    const progressFailed = document.getElementById('progressFailed');
    const progressPending = document.getElementById('progressPending');
    
    if (progressBarFill) progressBarFill.style.width = data.percentage + '%';
    if (progressPercentage) progressPercentage.textContent = data.percentage + '%';
    if (progressSent) progressSent.textContent = data.sentCount;
    if (progressFailed) progressFailed.textContent = data.failedCount;
    if (progressPending) progressPending.textContent = data.pendingCount;
    
    // Show failed list if there are failures
    if (data.failedCount > 0) {
        const failedList = document.getElementById('failedList');
        if (failedList) failedList.style.display = 'block';
    }
}

// ===== CAMPAIGN CONTROLS =====
async function pauseCampaign(campaignId) {
    try {
        const response = await fetch(`/api/campaign/${campaignId}/pause`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (!data.success) {
            showToast('Failed to pause campaign', 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function resumeCampaign(campaignId) {
    try {
        const response = await fetch(`/api/campaign/${campaignId}/resume`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (!data.success) {
            showToast('Failed to resume campaign', 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function stopCampaign(campaignId) {
    if (!confirm('Are you sure you want to stop this campaign?')) return;
    
    try {
        const response = await fetch(`/api/campaign/${campaignId}/stop`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (!data.success) {
            showToast('Failed to stop campaign', 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

// ===== RETRY FAILED NUMBERS =====
async function retryFailedNumbers() {
    if (!currentCampaignId) return;
    
    try {
        showLoading('Retrying failed numbers...');
        
        const response = await fetch(`/api/campaign/${currentCampaignId}/retry-failed`, {
            method: 'POST'
        });
        const data = await response.json();
        
        hideLoading();
        
        if (data.success) {
            showToast('Retry started for failed numbers', 'success');
        } else {
            showToast('Failed to retry', 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('Error: ' + error.message, 'error');
    }
}

// ===== FILE UPLOAD HELPERS =====
function clearFile() {
    const fileInput = document.getElementById('csvFileInput');
    const uploadedFile = document.getElementById('uploadedFile');
    
    if (fileInput) fileInput.value = '';
    if (uploadedFile) uploadedFile.style.display = 'none';
}

// ===== DRAG & DROP FILE UPLOAD =====
function initializeDragAndDrop() {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return;
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.background = 'rgba(99, 102, 241, 0.1)';
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.background = '';
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.background = '';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const fileInput = document.getElementById('csvFileInput');
            if (fileInput) {
                fileInput.files = files;
                handleCSVUpload({ target: fileInput });
            }
        }
    });
}

// ===== UTILITY FUNCTIONS =====
function formatNumber(num) {
    return num.toString().replace(/B(?=(d{3})+(?!d))/g, ",");
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', { 
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard', 'success');
    }).catch(() => {
        showToast('Failed to copy', 'error');
    });
}

// ===== AUTO-REFRESH DAILY STATS =====
function startDailyStatsRefresh() {
    setInterval(async () => {
        try {
            const response = await fetch('/api/stats/daily');
            const data = await response.json();
            
            if (data.success) {
                const dailyCount = document.getElementById('dailyCount');
                if (dailyCount) {
                    dailyCount.textContent = 
                        `${data.data.messagesSentToday} / ${data.data.dailyLimit}`;
                }
            }
        } catch (error) {
            console.error('Failed to refresh stats:', error);
        }
    }, 30000); // Refresh every 30 seconds
}

// ===== INITIALIZE ON PAGE LOAD =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing WhatsApp Bulk Sender System...');
    
    // Initialize Socket.IO
    initializeSocket();
    
    // Initialize drag & drop
    initializeDragAndDrop();
    
    // Start auto-refresh
    startDailyStatsRefresh();
    
    // Setup campaign control buttons
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const stopBtn = document.getElementById('stopBtn');
    const retryBtn = document.getElementById('retryFailedBtn');
    
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            if (currentCampaignId) pauseCampaign(currentCampaignId);
        });
    }
    
    if (resumeBtn) {
        resumeBtn.addEventListener('click', () => {
            if (currentCampaignId) resumeCampaign(currentCampaignId);
        });
    }
    
    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            if (currentCampaignId) stopCampaign(currentCampaignId);
        });
    }
    
    if (retryBtn) {
        retryBtn.addEventListener('click', retryFailedNumbers);
    }
    
    console.log('✅ System initialized successfully!');
});

// ===== EXPORT FUNCTIONS FOR GLOBAL ACCESS =====
window.showToast = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.pauseCampaign = pauseCampaign;
window.resumeCampaign = resumeCampaign;
window.stopCampaign = stopCampaign;
window.retryFailedNumbers = retryFailedNumbers;
window.clearFile = clearFile;
window.copyToClipboard = copyToClipboard;
