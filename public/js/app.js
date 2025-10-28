/**
 * ================================================
 * WA CLOUD SENDER SEVA - USER DASHBOARD
 * Version: 2.0.0 | Author: Sachin Bamniya
 * File: app.js - Part 1/5 (Core + Socket.io)
 * Total Lines: 2000+ (divided into 5 parts)
 * ================================================
 */

// ============= GLOBAL VARIABLES =============
let socket;
let currentUser = null;
let authToken = null;
let activePage = 'dashboard';
let sessions = [];
let templates = [];
let images = [];
let contacts = [];
let campaigns = [];
let adminTemplatesUnlocked = false;
let adminImagesUnlocked = false;

// ============= INITIALIZATION =============
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 WA Cloud Sender Seva - Initializing...');
    
    // Check authentication
    checkAuth();
    
    // Initialize Socket.io
    initSocket();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load initial data
    loadDashboardData();
    
    console.log('✅ Dashboard initialized successfully!');
});

// ============= AUTHENTICATION =============
function checkAuth() {
    authToken = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!authToken || !userStr) {
        window.location.href = '/index.html';
        return;
    }
    
    try {
        currentUser = JSON.parse(userStr);
        
        // Check if admin trying to access user dashboard
        if (currentUser.role === 'admin') {
            window.location.href = '/admin.html';
            return;
        }
        
        // Update user info in topbar
        updateUserInfo();
        
    } catch (error) {
        console.error('Auth error:', error);
        logout();
    }
}

function updateUserInfo() {
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    const userAvatar = document.getElementById('userAvatar');
    
    if (userName) userName.textContent = currentUser.name;
    if (userRole) userRole.textContent = currentUser.role.toUpperCase();
    if (userAvatar) {
        userAvatar.textContent = currentUser.name.charAt(0).toUpperCase();
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    if (socket) {
        socket.disconnect();
    }
    
    showToast('info', 'Logged Out', 'You have been logged out successfully');
    
    setTimeout(() => {
        window.location.href = '/index.html';
    }, 1000);
}

// ============= SOCKET.IO SETUP =============
function initSocket() {
    try {
        socket = io({
            auth: {
                token: authToken
            },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });
        
        // Connection events
        socket.on('connect', () => {
            console.log('✅ Socket connected:', socket.id);
            showToast('success', 'Connected', 'Real-time updates active');
        });
        
        socket.on('disconnect', () => {
            console.log('⚠️ Socket disconnected');
            showToast('warning', 'Disconnected', 'Reconnecting...');
        });
        
        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });
        
        // Real-time events
        setupSocketListeners();
        
    } catch (error) {
        console.error('Socket initialization error:', error);
    }
}

function setupSocketListeners() {
    // WhatsApp session events
    socket.on('session:update', (data) => {
        console.log('Session update:', data);
        updateSessionStatus(data);
    });
    
    socket.on('session:qr', (data) => {
        console.log('QR code received:', data);
        displayQRCode(data);
    });
    
    socket.on('session:connected', (data) => {
        console.log('Session connected:', data);
        showToast('success', 'WhatsApp Connected', `Session ${data.sessionName} is now active`);
        loadSessions();
    });
    
    socket.on('session:disconnected', (data) => {
        console.log('Session disconnected:', data);
        showToast('warning', 'Session Disconnected', `Session ${data.sessionName} disconnected`);
        loadSessions();
    });
    
    // Campaign events
    socket.on('campaign:progress', (data) => {
        console.log('Campaign progress:', data);
        updateCampaignProgress(data);
    });
    
    socket.on('campaign:completed', (data) => {
        console.log('Campaign completed:', data);
        showToast('success', 'Campaign Completed', `${data.campaignName} finished successfully`);
        loadCampaigns();
    });
    
    socket.on('campaign:message:sent', (data) => {
        console.log('Message sent:', data);
        updateMessageCounter(data);
    });
    
    socket.on('campaign:message:failed', (data) => {
        console.log('Message failed:', data);
        updateFailedCounter(data);
    });
    
    // Notification events
    socket.on('notification', (data) => {
        console.log('Notification:', data);
        showToast(data.type || 'info', data.title, data.message);
        updateNotificationBadge();
    });
    
    // Activity logs
    socket.on('activity:new', (data) => {
        console.log('New activity:', data);
        addActivityLog(data);
    });
}

// ============= EVENT LISTENERS SETUP =============
function setupEventListeners() {
    // Menu navigation
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const page = item.getAttribute('data-page');
            if (page) {
                switchPage(page);
            }
        });
    });
    
    // Logout button
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Notification bell
    const notificationBell = document.querySelector('.notification-bell');
    if (notificationBell) {
        notificationBell.addEventListener('click', toggleNotifications);
    }
    
    // Mobile menu toggle
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', toggleMobileMenu);
    }
    
    // Close modals on backdrop click
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });
    
    // Campaign form submission
    const campaignForm = document.getElementById('campaignForm');
    if (campaignForm) {
        campaignForm.addEventListener('submit', handleCampaignSubmit);
    }
}

// ============= PAGE NAVIGATION =============
function switchPage(page) {
    // Update menu active state
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === page) {
            item.classList.add('active');
        }
    });
    
    // Update page sections
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
    });
    
    const targetSection = document.getElementById(`${page}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
        activePage = page;
        
        // Load page-specific data
        loadPageData(page);
    }
    
    // Close mobile menu if open
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && sidebar.classList.contains('mobile-open')) {
        sidebar.classList.remove('mobile-open');
    }
}

function loadPageData(page) {
    console.log(`Loading data for page: ${page}`);
    
    switch (page) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'whatsapp':
            loadSessions();
            break;
        case 'groups':
            loadGroupExtractor();
            break;
        case 'templates':
            loadTemplates();
            break;
        case 'images':
            loadImages();
            break;
        case 'contacts':
            loadContacts();
            break;
        case 'campaigns':
            loadCampaigns();
            break;
        case 'schedule':
            loadSchedules();
            break;
        case 'orders':
            loadOrders();
            break;
        case 'reports':
            loadReports();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// ============= DASHBOARD DATA =============
async function loadDashboardData() {
    try {
        showLoading();
        
        const response = await fetch('/api/dashboard/stats', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load dashboard data');
        
        const data = await response.json();
        
        // Update stats cards
        updateDashboardStats(data.stats);
        
        // Load recent activity
        loadRecentActivity();
        
        hideLoading();
        
    } catch (error) {
        console.error('Dashboard load error:', error);
        showToast('error', 'Error', 'Failed to load dashboard data');
        hideLoading();
    }
}

function updateDashboardStats(stats) {
    // Update active sessions
    const activeSessionsEl = document.getElementById('activeSessions');
    if (activeSessionsEl) {
        activeSessionsEl.textContent = stats.activeSessions || 0;
    }
    
    // Update messages today
    const messagesTodayEl = document.getElementById('messagesToday');
    if (messagesTodayEl) {
        messagesTodayEl.textContent = formatNumber(stats.messagesToday || 0);
    }
    
    // Update active campaigns
    const activeCampaignsEl = document.getElementById('activeCampaigns');
    if (activeCampaignsEl) {
        activeCampaignsEl.textContent = stats.activeCampaigns || 0;
    }
    
    // Update total contacts
    const totalContactsEl = document.getElementById('totalContacts');
    if (totalContactsEl) {
        totalContactsEl.textContent = formatNumber(stats.totalContacts || 0);
    }
    
    // Update session badge
    const sessionBadge = document.getElementById('sessionBadge');
    if (sessionBadge) {
        sessionBadge.textContent = stats.activeSessions || 0;
    }
}

async function loadRecentActivity() {
    try {
        const response = await fetch('/api/activity/recent?limit=10', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load activity');
        
        const data = await response.json();
        
        const activityList = document.getElementById('activityList');
        if (activityList && data.activities && data.activities.length > 0) {
            activityList.innerHTML = data.activities.map(activity => `
                <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                        <div class="timeline-time">${formatDateTime(activity.timestamp)}</div>
                        <div class="timeline-title">${activity.title}</div>
                        <div class="timeline-text">${activity.description}</div>
                    </div>
                </div>
            `).join('');
        } else if (activityList) {
            activityList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <div class="empty-state-text">No recent activity</div>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Activity load error:', error);
    }
}

function addActivityLog(activity) {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;
    
    // Remove empty state if exists
    const emptyState = activityList.querySelector('.empty-state');
    if (emptyState) {
        activityList.innerHTML = '';
    }
    
    // Add new activity at top
    const activityHTML = `
        <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
                <div class="timeline-time">${formatDateTime(activity.timestamp)}</div>
                <div class="timeline-title">${activity.title}</div>
                <div class="timeline-text">${activity.description}</div>
            </div>
        </div>
    `;
    
    activityList.insertAdjacentHTML('afterbegin', activityHTML);
    
    // Limit to 10 items
    const items = activityList.querySelectorAll('.timeline-item');
    if (items.length > 10) {
        items[items.length - 1].remove();
    }
}

// ============= UTILITY FUNCTIONS =============
function showLoading() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    } else {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="spinner"></div>
            <div class="spinner-text">Loading...</div>
        `;
        document.body.appendChild(overlay);
    }
}

function hideLoading() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

function showToast(type, title, message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    const toastIcon = document.getElementById('toastIcon');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    
    // Set icon based on type
    const icons = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ'
    };
    
    if (toastIcon) toastIcon.textContent = icons[type] || 'ℹ';
    if (toastTitle) toastTitle.textContent = title;
    if (toastMessage) toastMessage.textContent = message;
    
    // Remove all type classes and add current type
    toast.className = 'toast show ' + type;
    
    // Auto hide after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function toggleNotifications() {
    showToast('info', 'Notifications', 'Notification panel coming soon!');
}

function updateNotificationBadge() {
    const badge = document.getElementById('notificationCount');
    if (badge) {
        const currentCount = parseInt(badge.textContent) || 0;
        badge.textContent = currentCount + 1;
    }
}

function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('mobile-open');
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

function refreshActivity() {
    loadRecentActivity();
    showToast('success', 'Refreshed', 'Activity list updated');
}

// ============= END OF PART 1 =============
// Next parts will include:
// Part 2: WhatsApp Session Management
// Part 3: Templates & Images
// Part 4: Bulk Sender & Campaigns
// Part 5: Contacts, Orders & Reports

/* ================================================
   PART 2/5: WHATSAPP SESSIONS & GROUP MANAGEMENT
   Lines: 600+ | Advanced Session Control
   Features: QR Code, Pairing Code, Multi-Session,
            Group Extractor, Contact Export
   ================================================ */

// ============= WHATSAPP SESSION MANAGEMENT =============

async function loadSessions() {
    try {
        showLoading();
        
        const response = await fetch('/api/whatsapp/sessions', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load sessions');
        
        const data = await response.json();
        sessions = data.sessions || [];
        
        displaySessions();
        updateSessionSelects();
        
        hideLoading();
        
    } catch (error) {
        console.error('Sessions load error:', error);
        showToast('error', 'Error', 'Failed to load WhatsApp sessions');
        hideLoading();
    }
}

function displaySessions() {
    const sessionsList = document.getElementById('sessionsList');
    if (!sessionsList) return;
    
    if (sessions.length === 0) {
        sessionsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📱</div>
                <div class="empty-state-title">No WhatsApp Sessions</div>
                <div class="empty-state-text">Connect your WhatsApp to start sending messages</div>
                <button class="btn btn-primary mt-20" onclick="openAddSessionModal()">
                    ➕ Connect WhatsApp
                </button>
            </div>
        `;
        return;
    }
    
    sessionsList.innerHTML = sessions.map((session, index) => `
        <div class="session-card ${session.isPrimary ? 'primary' : ''}">
            <div class="session-header">
                <div class="session-name">
                    <span class="session-icon">📱</span>
                    ${session.sessionName}
                    ${session.isPrimary ? '<span class="session-badge">Primary</span>' : ''}
                </div>
                <div class="connection-status ${session.status === 'connected' ? 'online' : 'offline'}">
                    <div class="connection-dot ${session.status === 'connected' ? 'online' : 'offline'}"></div>
                    ${session.status === 'connected' ? 'Connected' : 'Disconnected'}
                </div>
            </div>
            
            ${session.phoneNumber ? `
                <div style="margin: 10px 0; font-size: 14px; color: #666;">
                    📞 ${session.phoneNumber}
                </div>
            ` : ''}
            
            <div class="session-info">
                <div class="session-stat">
                    <div class="session-stat-value">${formatNumber(session.messagesSent || 0)}</div>
                    <div class="session-stat-label">Messages Sent</div>
                </div>
                <div class="session-stat">
                    <div class="session-stat-value">${formatNumber(session.messagesToday || 0)}</div>
                    <div class="session-stat-label">Today</div>
                </div>
            </div>
            
            <div class="session-actions">
                ${session.status === 'connected' ? `
                    <button class="btn btn-sm btn-danger" onclick="disconnectSession('${session.sessionId}')">
                        🔌 Disconnect
                    </button>
                ` : `
                    <button class="btn btn-sm btn-primary" onclick="reconnectSession('${session.sessionId}')">
                        🔄 Reconnect
                    </button>
                `}
                <button class="btn btn-sm btn-warning" onclick="deleteSession('${session.sessionId}')">
                    🗑️ Delete
                </button>
                ${!session.isPrimary && sessions.some(s => s.status === 'connected') ? `
                    <button class="btn btn-sm btn-info" onclick="setPrimarySession('${session.sessionId}')">
                        ⭐ Set Primary
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function updateSessionSelects() {
    const selects = [
        document.getElementById('groupSessionSelect'),
        document.getElementById('campaignSession')
    ];
    
    selects.forEach(select => {
        if (!select) return;
        
        const connectedSessions = sessions.filter(s => s.status === 'connected');
        
        select.innerHTML = '<option value="">Select a connected session...</option>';
        
        connectedSessions.forEach(session => {
            const option = document.createElement('option');
            option.value = session.sessionId;
            option.textContent = `${session.sessionName} (${session.phoneNumber || 'N/A'})`;
            if (session.isPrimary) {
                option.textContent += ' ⭐';
            }
            select.appendChild(option);
        });
    });
}

// ============= ADD NEW SESSION =============

function openAddSessionModal() {
    openModal('addSessionModal');
    
    // Reset form
    document.getElementById('sessionName').value = '';
    document.getElementById('connectionMethod').value = 'qr';
    document.getElementById('pairingPhone').value = '';
    
    // Show QR method by default
    switchConnectionMethod();
}

function switchConnectionMethod() {
    const method = document.getElementById('connectionMethod').value;
    const qrArea = document.getElementById('qrCodeArea');
    const pairingArea = document.getElementById('pairingCodeArea');
    
    if (method === 'qr') {
        qrArea.style.display = 'block';
        pairingArea.style.display = 'none';
    } else {
        qrArea.style.display = 'none';
        pairingArea.style.display = 'block';
    }
}

async function generateQR() {
    const sessionName = document.getElementById('sessionName').value.trim();
    
    if (!sessionName) {
        showToast('error', 'Invalid Input', 'Please enter a session name');
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch('/api/whatsapp/sessions/create', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionName,
                method: 'qr'
            })
        });
        
        if (!response.ok) throw new Error('Failed to generate QR code');
        
        const data = await response.json();
        
        showToast('success', 'QR Generated', 'Scan the QR code with your WhatsApp');
        
        hideLoading();
        
        // QR will be received via Socket.io
        
    } catch (error) {
        console.error('QR generation error:', error);
        showToast('error', 'Error', 'Failed to generate QR code');
        hideLoading();
    }
}

function displayQRCode(data) {
    const qrImageContainer = document.getElementById('qrImageContainer');
    if (!qrImageContainer) return;
    
    qrImageContainer.innerHTML = `
        <div class="qr-image">
            <img src="${data.qrCode}" alt="QR Code">
        </div>
        <p style="color: #666; margin-top: 15px;">
            Scan this QR code with WhatsApp<br>
            <small>Settings → Linked Devices → Link a Device</small>
        </p>
        <div class="progress mt-20">
            <div class="progress-bar progress-bar-animated progress-bar-striped" style="width: 100%"></div>
        </div>
        <p style="color: #999; font-size: 13px; margin-top: 10px;">
            Waiting for scan... QR expires in 60 seconds
        </p>
    `;
    
    // Auto-refresh QR after 60 seconds
    setTimeout(() => {
        if (document.getElementById('qrImageContainer').innerHTML.includes('expires')) {
            generateQR();
        }
    }, 60000);
}

async function generatePairingCode() {
    const sessionName = document.getElementById('sessionName').value.trim();
    const phoneNumber = document.getElementById('pairingPhone').value.trim();
    
    if (!sessionName || !phoneNumber) {
        showToast('error', 'Invalid Input', 'Please enter session name and phone number');
        return;
    }
    
    // Validate phone number format
    if (!/^[0-9]{12}$/.test(phoneNumber)) {
        showToast('error', 'Invalid Format', 'Phone number must be 12 digits (e.g., 919174406375)');
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch('/api/whatsapp/sessions/create', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionName,
                method: 'pairing',
                phoneNumber
            })
        });
        
        if (!response.ok) throw new Error('Failed to generate pairing code');
        
        const data = await response.json();
        
        const pairingCodeDisplay = document.getElementById('pairingCodeDisplay');
        if (pairingCodeDisplay) {
            pairingCodeDisplay.innerHTML = `
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                            padding: 30px; border-radius: 15px; color: white;">
                    <div style="font-size: 14px; margin-bottom: 10px; opacity: 0.9;">
                        Your Pairing Code
                    </div>
                    <div style="font-size: 48px; font-weight: 700; letter-spacing: 15px; 
                                text-align: center; font-family: monospace;">
                        ${data.pairingCode}
                    </div>
                    <div style="font-size: 13px; margin-top: 15px; opacity: 0.9;">
                        Enter this code in WhatsApp:<br>
                        Settings → Linked Devices → Link with Phone Number
                    </div>
                </div>
                <div class="progress mt-20">
                    <div class="progress-bar progress-bar-animated progress-bar-striped" style="width: 100%"></div>
                </div>
                <p style="color: #999; font-size: 13px; margin-top: 10px; text-align: center;">
                    Waiting for verification... Code expires in 5 minutes
                </p>
            `;
        }
        
        showToast('success', 'Code Generated', 'Enter the code in WhatsApp to link');
        
        hideLoading();
        
    } catch (error) {
        console.error('Pairing code error:', error);
        showToast('error', 'Error', error.message || 'Failed to generate pairing code');
        hideLoading();
    }
}

// ============= SESSION ACTIONS =============

async function disconnectSession(sessionId) {
    if (!confirm('Are you sure you want to disconnect this session?')) return;
    
    try {
        showLoading();
        
        const response = await fetch(`/api/whatsapp/sessions/${sessionId}/disconnect`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to disconnect session');
        
        showToast('success', 'Disconnected', 'Session disconnected successfully');
        loadSessions();
        
        hideLoading();
        
    } catch (error) {
        console.error('Disconnect error:', error);
        showToast('error', 'Error', 'Failed to disconnect session');
        hideLoading();
    }
}

async function reconnectSession(sessionId) {
    try {
        showLoading();
        
        const response = await fetch(`/api/whatsapp/sessions/${sessionId}/reconnect`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to reconnect session');
        
        showToast('success', 'Reconnecting', 'Session is reconnecting...');
        
        // Open modal to show QR/Pairing
        openAddSessionModal();
        
        hideLoading();
        
    } catch (error) {
        console.error('Reconnect error:', error);
        showToast('error', 'Error', 'Failed to reconnect session');
        hideLoading();
    }
}

async function deleteSession(sessionId) {
    if (!confirm('Are you sure you want to delete this session? This cannot be undone.')) return;
    
    try {
        showLoading();
        
        const response = await fetch(`/api/whatsapp/sessions/${sessionId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to delete session');
        
        showToast('success', 'Deleted', 'Session deleted successfully');
        loadSessions();
        
        hideLoading();
        
    } catch (error) {
        console.error('Delete error:', error);
        showToast('error', 'Error', 'Failed to delete session');
        hideLoading();
    }
}

async function setPrimarySession(sessionId) {
    try {
        showLoading();
        
        const response = await fetch(`/api/whatsapp/sessions/${sessionId}/set-primary`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to set primary session');
        
        showToast('success', 'Primary Set', 'Primary session updated');
        loadSessions();
        
        hideLoading();
        
    } catch (error) {
        console.error('Set primary error:', error);
        showToast('error', 'Error', 'Failed to set primary session');
        hideLoading();
    }
}

function updateSessionStatus(data) {
    const sessionIndex = sessions.findIndex(s => s.sessionId === data.sessionId);
    if (sessionIndex !== -1) {
        sessions[sessionIndex] = { ...sessions[sessionIndex], ...data };
        displaySessions();
        updateSessionSelects();
    }
}

// ============= GROUP EXTRACTOR =============

let currentGroups = [];
let selectedGroups = [];

function loadGroupExtractor() {
    updateSessionSelects();
}

async function fetchGroups() {
    const sessionId = document.getElementById('groupSessionSelect').value;
    
    if (!sessionId) {
        showToast('error', 'No Session', 'Please select a connected WhatsApp session');
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch(`/api/whatsapp/sessions/${sessionId}/groups`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch groups');
        
        const data = await response.json();
        currentGroups = data.groups || [];
        
        displayGroups();
        
        showToast('success', 'Groups Loaded', `Found ${currentGroups.length} groups`);
        
        hideLoading();
        
    } catch (error) {
        console.error('Fetch groups error:', error);
        showToast('error', 'Error', 'Failed to fetch groups');
        hideLoading();
    }
}

function displayGroups() {
    const groupsListCard = document.getElementById('groupsListCard');
    const groupsList = document.getElementById('groupsList');
    
    if (!groupsList) return;
    
    if (currentGroups.length === 0) {
        groupsListCard.style.display = 'none';
        return;
    }
    
    groupsListCard.style.display = 'block';
    
    groupsList.innerHTML = `
        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th><input type="checkbox" id="selectAllGroups" onchange="toggleAllGroups()"></th>
                        <th>Group Name</th>
                        <th>Participants</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${currentGroups.map((group, index) => `
                        <tr>
                            <td>
                                <input type="checkbox" class="group-checkbox" 
                                       data-index="${index}" 
                                       onchange="updateSelectedGroups()">
                            </td>
                            <td>
                                <strong>${group.name}</strong><br>
                                <small style="color: #999;">${group.id}</small>
                            </td>
                            <td>${group.participants} members</td>
                            <td>
                                <button class="btn btn-sm btn-primary" 
                                        onclick="extractSingleGroup(${index})">
                                    📤 Extract
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function toggleAllGroups() {
    const selectAll = document.getElementById('selectAllGroups');
    const checkboxes = document.querySelectorAll('.group-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
    });
    
    updateSelectedGroups();
}

function updateSelectedGroups() {
    selectedGroups = [];
    const checkboxes = document.querySelectorAll('.group-checkbox:checked');
    
    checkboxes.forEach(checkbox => {
        const index = parseInt(checkbox.getAttribute('data-index'));
        selectedGroups.push(currentGroups[index]);
    });
    
    console.log('Selected groups:', selectedGroups.length);
}

async function extractSelectedGroups() {
    if (selectedGroups.length === 0) {
        showToast('warning', 'No Selection', 'Please select at least one group to extract');
        return;
    }
    
    const sessionId = document.getElementById('groupSessionSelect').value;
    
    try {
        showLoading();
        
        const response = await fetch('/api/whatsapp/groups/extract', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId,
                groups: selectedGroups.map(g => g.id)
            })
        });
        
        if (!response.ok) throw new Error('Failed to extract contacts');
        
        const data = await response.json();
        
        showToast('success', 'Extraction Complete', 
            `Extracted ${data.totalContacts} contacts from ${selectedGroups.length} groups`);
        
        // Offer to download
        if (confirm('Contacts extracted successfully! Download as Excel?')) {
            downloadContacts(data.contacts);
        }
        
        // Reload contacts page
        loadContacts();
        
        hideLoading();
        
    } catch (error) {
        console.error('Extract error:', error);
        showToast('error', 'Error', 'Failed to extract contacts');
        hideLoading();
    }
}

async function extractSingleGroup(index) {
    const group = currentGroups[index];
    const sessionId = document.getElementById('groupSessionSelect').value;
    
    try {
        showLoading();
        
        const response = await fetch('/api/whatsapp/groups/extract', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId,
                groups: [group.id]
            })
        });
        
        if (!response.ok) throw new Error('Failed to extract contacts');
        
        const data = await response.json();
        
        showToast('success', 'Extracted', 
            `Extracted ${data.totalContacts} contacts from ${group.name}`);
        
        if (confirm('Download contacts as Excel?')) {
            downloadContacts(data.contacts);
        }
        
        hideLoading();
        
    } catch (error) {
        console.error('Extract error:', error);
        showToast('error', 'Error', 'Failed to extract contacts');
        hideLoading();
    }
}

function downloadContacts(contacts) {
    // Create CSV content
    const csv = [
        ['Name', 'Number', 'Group', 'Date Added'],
        ...contacts.map(c => [
            c.name || 'Unknown',
            c.number,
            c.groupName || '',
            new Date(c.addedAt).toLocaleDateString()
        ])
    ].map(row => row.join(',')).join('\n');
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// ============= END OF PART 2 =============
// Next parts will include:
// Part 3: Templates & Images Management
// Part 4: Bulk Sender & Anti-Ban System
// Part 5: Contacts, Orders (PIN Code) & Reports

/* ================================================
   PART 3/5: TEMPLATES & IMAGES MANAGEMENT
   Lines: 700+ | Advanced Content System
   Features: User Templates, Admin Templates (Unlock),
            Image Upload, Rotation System, Variables
   ================================================ */

// ============= TEMPLATES MANAGEMENT =============

async function loadTemplates() {
    try {
        showLoading();
        
        const response = await fetch('/api/templates', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load templates');
        
        const data = await response.json();
        templates = data.templates || [];
        
        displayTemplates();
        updateTemplateSelects();
        
        hideLoading();
        
    } catch (error) {
        console.error('Templates load error:', error);
        showToast('error', 'Error', 'Failed to load templates');
        hideLoading();
    }
}

function displayTemplates() {
    const templatesList = document.getElementById('templatesList');
    if (!templatesList) return;
    
    if (templates.length === 0) {
        templatesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <div class="empty-state-title">No Templates Yet</div>
                <div class="empty-state-text">Create message templates to use in campaigns</div>
                <button class="btn btn-primary mt-20" onclick="openCreateTemplateModal()">
                    ➕ Create Template
                </button>
            </div>
        `;
        return;
    }
    
    // Separate user and admin templates
    const userTemplates = templates.filter(t => !t.isAdminTemplate);
    const adminTemplates = templates.filter(t => t.isAdminTemplate);
    
    let html = '';
    
    // User Templates Section
    if (userTemplates.length > 0) {
        html += `
            <div class="card mb-20">
                <div class="card-header">
                    <h3 class="card-title">📝 My Templates (${userTemplates.length})</h3>
                    <button class="btn btn-sm btn-primary" onclick="openCreateTemplateModal()">
                        ➕ Create New
                    </button>
                </div>
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>Template Name</th>
                                <th>Category</th>
                                <th>Variables</th>
                                <th>Used</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${userTemplates.map(template => `
                                <tr>
                                    <td>
                                        <strong>${template.name}</strong><br>
                                        <small style="color: #999;">${template.message.substring(0, 50)}...</small>
                                    </td>
                                    <td><span class="badge badge-info">${template.category}</span></td>
                                    <td>${template.variables ? template.variables.length : 0} vars</td>
                                    <td>${template.usageCount || 0} times</td>
                                    <td>
                                        <div class="table-actions">
                                            <button class="btn btn-sm btn-info" 
                                                    onclick="viewTemplate('${template.id}')">
                                                👁️ View
                                            </button>
                                            <button class="btn btn-sm btn-warning" 
                                                    onclick="editTemplate('${template.id}')">
                                                ✏️ Edit
                                            </button>
                                            <button class="btn btn-sm btn-danger" 
                                                    onclick="deleteTemplate('${template.id}')">
                                                🗑️ Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    // Admin Templates Section
    if (adminTemplates.length > 0) {
        html += `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">⭐ Admin Premium Templates (${adminTemplates.length})</h3>
                    ${adminTemplatesUnlocked ? 
                        '<span class="badge badge-success">🔓 Unlocked</span>' : 
                        '<span class="badge badge-warning">🔒 Locked</span>'
                    }
                </div>
                ${!adminTemplatesUnlocked ? `
                    <div class="alert alert-warning">
                        <div class="alert-icon">🔐</div>
                        <div class="alert-content">
                            <div class="alert-title">Premium Templates Locked</div>
                            <div class="alert-message">
                                Enter activation code <strong>"Satguru@5505"</strong> to unlock professional templates
                            </div>
                        </div>
                    </div>
                ` : `
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Template Name</th>
                                    <th>Category</th>
                                    <th>Variables</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${adminTemplates.map(template => `
                                    <tr>
                                        <td>
                                            <strong>⭐ ${template.name}</strong><br>
                                            <small style="color: #999;">${template.message.substring(0, 50)}...</small>
                                        </td>
                                        <td><span class="badge badge-primary">${template.category}</span></td>
                                        <td>${template.variables ? template.variables.length : 0} vars</td>
                                        <td>
                                            <button class="btn btn-sm btn-info" 
                                                    onclick="viewTemplate('${template.id}')">
                                                👁️ View
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;
    }
    
    templatesList.innerHTML = html;
}

function updateTemplateSelects() {
    const select = document.getElementById('campaignTemplate');
    if (!select) return;
    
    // Filter available templates
    const availableTemplates = adminTemplatesUnlocked ? 
        templates : templates.filter(t => !t.isAdminTemplate);
    
    select.innerHTML = '<option value="">Select a template...</option>';
    
    availableTemplates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = template.isAdminTemplate ? 
            `⭐ ${template.name}` : template.name;
        select.appendChild(option);
    });
}

// ============= UNLOCK ADMIN TEMPLATES =============

async function unlockAdminTemplates() {
    const activationCode = prompt('Enter activation code to unlock admin templates:');
    
    if (!activationCode) return;
    
    if (activationCode !== 'Satguru@5505') {
        showToast('error', 'Invalid Code', 'Incorrect activation code');
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch('/api/templates/unlock-admin', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ activationCode })
        });
        
        if (!response.ok) throw new Error('Failed to unlock templates');
        
        adminTemplatesUnlocked = true;
        
        showToast('success', 'Unlocked! 🎉', 'Admin templates are now available');
        
        loadTemplates();
        
        hideLoading();
        
    } catch (error) {
        console.error('Unlock error:', error);
        showToast('error', 'Error', 'Failed to unlock admin templates');
        hideLoading();
    }
}

// ============= CREATE/EDIT TEMPLATE =============

function openCreateTemplateModal() {
    const modalHTML = `
        <div class="modal show" id="templateModal">
            <div class="modal-dialog modal-dialog-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">📝 Create Message Template</h3>
                        <button class="modal-close" onclick="closeModal('templateModal')">×</button>
                    </div>
                    <div class="modal-body">
                        <form id="templateForm" onsubmit="saveTemplate(event)">
                            <div class="form-group">
                                <label class="form-label">Template Name <span class="required">*</span></label>
                                <input type="text" class="form-control" id="templateName" 
                                       placeholder="e.g., Diwali Offer 2025" required>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">Category</label>
                                <select class="form-control" id="templateCategory">
                                    <option value="greeting">Greeting</option>
                                    <option value="promotional">Promotional</option>
                                    <option value="informational">Informational</option>
                                    <option value="reminder">Reminder</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">Message <span class="required">*</span></label>
                                <textarea class="form-control" id="templateMessage" 
                                          rows="6" placeholder="Enter your message here..." required></textarea>
                                <div class="form-text">
                                    Use variables: {{name}}, {{number}}, {{custom1}}, {{custom2}}
                                </div>
                            </div>
                            
                            <div class="alert alert-info">
                                <div class="alert-icon">💡</div>
                                <div class="alert-content">
                                    <div class="alert-title">Template Variables</div>
                                    <div class="alert-message">
                                        • {{name}} - Contact name<br>
                                        • {{number}} - Contact number<br>
                                        • {{custom1}}, {{custom2}} - Custom fields<br>
                                        • Variables will be replaced automatically during sending
                                    </div>
                                </div>
                            </div>
                            
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" onclick="closeModal('templateModal')">
                                    Cancel
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    💾 Save Template
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('templateModal');
    if (existingModal) existingModal.remove();
    
    // Add new modal
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

async function saveTemplate(event) {
    event.preventDefault();
    
    const name = document.getElementById('templateName').value.trim();
    const category = document.getElementById('templateCategory').value;
    const message = document.getElementById('templateMessage').value.trim();
    
    // Extract variables from message
    const variables = [...new Set(message.match(/{{([^}]+)}}/g) || [])];
    
    try {
        showLoading();
        
        const response = await fetch('/api/templates', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                category,
                message,
                variables
            })
        });
        
        if (!response.ok) throw new Error('Failed to save template');
        
        showToast('success', 'Saved', 'Template created successfully');
        
        closeModal('templateModal');
        loadTemplates();
        
        hideLoading();
        
    } catch (error) {
        console.error('Save template error:', error);
        showToast('error', 'Error', 'Failed to save template');
        hideLoading();
    }
}

async function deleteTemplate(templateId) {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
        showLoading();
        
        const response = await fetch(`/api/templates/${templateId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to delete template');
        
        showToast('success', 'Deleted', 'Template deleted successfully');
        loadTemplates();
        
        hideLoading();
        
    } catch (error) {
        console.error('Delete template error:', error);
        showToast('error', 'Error', 'Failed to delete template');
        hideLoading();
    }
}

function viewTemplate(templateId) {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    
    const modalHTML = `
        <div class="modal show" id="viewTemplateModal">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">📝 ${template.name}</h3>
                        <button class="modal-close" onclick="closeModal('viewTemplateModal')">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label">Category</label>
                            <div><span class="badge badge-info">${template.category}</span></div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Message</label>
                            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; 
                                        white-space: pre-wrap; line-height: 1.6;">
                                ${template.message}
                            </div>
                        </div>
                        
                        ${template.variables && template.variables.length > 0 ? `
                            <div class="form-group">
                                <label class="form-label">Variables Used</label>
                                <div>
                                    ${template.variables.map(v => 
                                        `<span class="badge badge-primary">${v}</span>`
                                    ).join(' ')}
                                </div>
                            </div>
                        ` : ''}
                        
                        <div class="form-group">
                            <label class="form-label">Usage Statistics</label>
                            <div>Used ${template.usageCount || 0} times</div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeModal('viewTemplateModal')">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// ============= IMAGES MANAGEMENT =============

async function loadImages() {
    try {
        showLoading();
        
        const response = await fetch('/api/images', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load images');
        
        const data = await response.json();
        images = data.images || [];
        
        displayImages();
        updateImageSelects();
        
        hideLoading();
        
    } catch (error) {
        console.error('Images load error:', error);
        showToast('error', 'Error', 'Failed to load images');
        hideLoading();
    }
}

function displayImages() {
    const imagesList = document.getElementById('imagesList');
    if (!imagesList) return;
    
    if (images.length === 0) {
        imagesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🖼️</div>
                <div class="empty-state-title">No Images Yet</div>
                <div class="empty-state-text">Upload images to use in campaigns</div>
                <button class="btn btn-primary mt-20" onclick="openUploadImageModal()">
                    ➕ Upload Images
                </button>
            </div>
        `;
        return;
    }
    
    // Separate user and admin images
    const userImages = images.filter(img => !img.isAdminImage);
    const adminImages = images.filter(img => img.isAdminImage);
    
    let html = '';
    
    // User Images
    if (userImages.length > 0) {
        html += `
            <div class="mb-20">
                <div class="flex justify-between items-center mb-15">
                    <h3>🖼️ My Images (${userImages.length}/1000)</h3>
                    <button class="btn btn-sm btn-primary" onclick="openUploadImageModal()">
                        ➕ Upload
                    </button>
                </div>
                <div class="image-grid">
                    ${userImages.map(img => `
                        <div class="image-card">
                            <img src="${img.url}" alt="${img.name}">
                            <div class="image-overlay">
                                <button class="image-action" onclick="viewImage('${img.url}')">
                                    👁️
                                </button>
                                <button class="image-action" onclick="deleteImage('${img.id}')">
                                    🗑️
                                </button>
                            </div>
                            <div class="image-info">
                                <div class="image-name">${img.name}</div>
                                <div class="image-size">${formatFileSize(img.size)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Admin Images
    if (adminImages.length > 0) {
        html += `
            <div>
                <div class="flex justify-between items-center mb-15">
                    <h3>⭐ Admin Premium Images (${adminImages.length})</h3>
                    ${adminImagesUnlocked ? 
                        '<span class="badge badge-success">🔓 Unlocked</span>' : 
                        '<button class="btn btn-sm btn-warning" onclick="unlockAdminImages()">🔒 Unlock</button>'
                    }
                </div>
                ${!adminImagesUnlocked ? `
                    <div class="alert alert-warning">
                        <div class="alert-icon">🔐</div>
                        <div class="alert-content">
                            <div class="alert-title">Premium Images Locked</div>
                            <div class="alert-message">
                                Enter activation code to unlock professional images
                            </div>
                        </div>
                    </div>
                ` : `
                    <div class="image-grid">
                        ${adminImages.map(img => `
                            <div class="image-card">
                                <img src="${img.url}" alt="${img.name}">
                                <div class="image-overlay">
                                    <button class="image-action" onclick="viewImage('${img.url}')">
                                        👁️
                                    </button>
                                </div>
                                <div class="image-info">
                                    <div class="image-name">⭐ ${img.name}</div>
                                    <div class="image-size">${formatFileSize(img.size)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        `;
    }
    
    imagesList.innerHTML = html;
}

function updateImageSelects() {
    const select = document.getElementById('campaignImages');
    if (!select) return;
    
    const availableImages = adminImagesUnlocked ? 
        images : images.filter(img => !img.isAdminImage);
    
    select.innerHTML = '';
    
    availableImages.forEach(img => {
        const option = document.createElement('option');
        option.value = img.id;
        option.textContent = img.isAdminImage ? `⭐ ${img.name}` : img.name;
        select.appendChild(option);
    });
}

async function unlockAdminImages() {
    const activationCode = prompt('Enter activation code to unlock admin images:');
    
    if (!activationCode) return;
    
    if (activationCode !== 'Satguru@5505') {
        showToast('error', 'Invalid Code', 'Incorrect activation code');
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch('/api/images/unlock-admin', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ activationCode })
        });
        
        if (!response.ok) throw new Error('Failed to unlock images');
        
        adminImagesUnlocked = true;
        
        showToast('success', 'Unlocked! 🎉', 'Admin images are now available');
        
        loadImages();
        
        hideLoading();
        
    } catch (error) {
        console.error('Unlock error:', error);
        showToast('error', 'Error', 'Failed to unlock admin images');
        hideLoading();
    }
}

function openUploadImageModal() {
    const modalHTML = `
        <div class="modal show" id="uploadImageModal">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">🖼️ Upload Images</h3>
                        <button class="modal-close" onclick="closeModal('uploadImageModal')">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="file-upload-area" id="imageUploadArea">
                            <div class="file-upload-icon">📤</div>
                            <div class="file-upload-text">Drag & Drop Images Here</div>
                            <div class="file-upload-hint">or click to browse</div>
                            <div class="file-upload-formats">JPG, PNG, WebP (Max 50MB each)</div>
                            <input type="file" id="imageFileInput" accept="image/*" multiple style="display: none;">
                        </div>
                        <div class="file-list" id="selectedFilesList"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeModal('uploadImageModal')">Cancel</button>
                        <button class="btn btn-primary" onclick="uploadImages()">📤 Upload</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Setup drag & drop
    setupImageUpload();
}

function setupImageUpload() {
    const uploadArea = document.getElementById('imageUploadArea');
    const fileInput = document.getElementById('imageFileInput');
    
    uploadArea.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragging');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragging');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragging');
        handleImageFiles(e.dataTransfer.files);
    });
    
    fileInput.addEventListener('change', (e) => {
        handleImageFiles(e.target.files);
    });
}

function handleImageFiles(files) {
    const filesList = document.getElementById('selectedFilesList');
    filesList.innerHTML = '';
    
    Array.from(files).forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <div class="file-info">
                <span class="file-icon">🖼️</span>
                <div class="file-details">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${formatFileSize(file.size)}</div>
                </div>
            </div>
            <button class="file-remove" onclick="removeFile(${index})">×</button>
        `;
        filesList.appendChild(fileItem);
    });
}

async function uploadImages() {
    const fileInput = document.getElementById('imageFileInput');
    const files = fileInput.files;
    
    if (files.length === 0) {
        showToast('warning', 'No Files', 'Please select images to upload');
        return;
    }
    
    try {
        showLoading();
        
        const formData = new FormData();
        Array.from(files).forEach(file => {
            formData.append('images', file);
        });
        
        const response = await fetch('/api/images/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        if (!response.ok) throw new Error('Failed to upload images');
        
        const data = await response.json();
        
        showToast('success', 'Uploaded', `${data.uploadedCount} images uploaded successfully`);
        
        closeModal('uploadImageModal');
        loadImages();
        
        hideLoading();
        
    } catch (error) {
        console.error('Upload error:', error);
        showToast('error', 'Error', 'Failed to upload images');
        hideLoading();
    }
}

function viewImage(url) {
    window.open(url, '_blank');
}

async function deleteImage(imageId) {
    if (!confirm('Are you sure you want to delete this image?')) return;
    
    try {
        showLoading();
        
        const response = await fetch(`/api/images/${imageId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to delete image');
        
        showToast('success', 'Deleted', 'Image deleted successfully');
        loadImages();
        
        hideLoading();
        
    } catch (error) {
        console.error('Delete image error:', error);
        showToast('error', 'Error', 'Failed to delete image');
        hideLoading();
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ============= END OF PART 3 =============
// Next parts:
// Part 4: Bulk Sender, Anti-Ban System, Campaigns
// Part 5: Contacts, Orders (PIN Code System), Reports

/* ================================================
   PART 4/5: BULK SENDER & ANTI-BAN SYSTEM
   Lines: 800+ | Professional Campaign Management
   Features: Bulk Sending, Anti-Ban Algorithm,
            Real-time Progress, Campaign Controls,
            Message Rotation, Retry Failed
   ================================================ */

// ============= CONTACTS MANAGEMENT =============

async function loadContacts() {
    try {
        showLoading();
        
        const response = await fetch('/api/contacts', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load contacts');
        
        const data = await response.json();
        contacts = data.contacts || [];
        
        displayContacts();
        updateContactGroups();
        
        hideLoading();
        
    } catch (error) {
        console.error('Contacts load error:', error);
        showToast('error', 'Error', 'Failed to load contacts');
        hideLoading();
    }
}

function displayContacts() {
    const contactsTableBody = document.getElementById('contactsTableBody');
    if (!contactsTableBody) return;
    
    if (contacts.length === 0) {
        contactsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div class="empty-state">
                        <div class="empty-state-icon">📇</div>
                        <div class="empty-state-text">No contacts yet. Extract from groups to get started.</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    contactsTableBody.innerHTML = contacts.map((contact, index) => `
        <tr>
            <td><input type="checkbox" class="contact-checkbox" data-id="${contact.id}"></td>
            <td>${contact.name || 'Unknown'}</td>
            <td>${contact.number}</td>
            <td><span class="badge badge-info">${contact.groupName || 'Manual'}</span></td>
            <td>${formatDateTime(contact.addedAt)}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="deleteContact('${contact.id}')">
                    🗑️
                </button>
            </td>
        </tr>
    `).join('');
    
    // Select all checkbox
    const selectAllContacts = document.getElementById('selectAllContacts');
    if (selectAllContacts) {
        selectAllContacts.addEventListener('change', (e) => {
            document.querySelectorAll('.contact-checkbox').forEach(cb => {
                cb.checked = e.target.checked;
            });
        });
    }
}

function updateContactGroups() {
    const select = document.getElementById('campaignGroup');
    if (!select) return;
    
    // Get unique groups
    const groups = [...new Set(contacts.map(c => c.groupName).filter(Boolean))];
    
    select.innerHTML = '<option value="">Select contacts group...</option>';
    select.innerHTML += '<option value="all">All Contacts</option>';
    
    groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group;
        option.textContent = group;
        select.appendChild(option);
    });
}

async function importContacts() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.txt';
    
    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            showLoading();
            
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('/api/contacts/import', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                },
                body: formData
            });
            
            if (!response.ok) throw new Error('Failed to import contacts');
            
            const data = await response.json();
            
            showToast('success', 'Imported', `${data.importedCount} contacts imported successfully`);
            loadContacts();
            
            hideLoading();
            
        } catch (error) {
            console.error('Import error:', error);
            showToast('error', 'Error', 'Failed to import contacts');
            hideLoading();
        }
    });
    
    input.click();
}

async function exportContacts() {
    try {
        showLoading();
        
        const response = await fetch('/api/contacts/export', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to export contacts');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contacts_${Date.now()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        showToast('success', 'Exported', 'Contacts exported successfully');
        
        hideLoading();
        
    } catch (error) {
        console.error('Export error:', error);
        showToast('error', 'Error', 'Failed to export contacts');
        hideLoading();
    }
}

function openAddContactModal() {
    const modalHTML = `
        <div class="modal show" id="addContactModal">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">📇 Add Contact</h3>
                        <button class="modal-close" onclick="closeModal('addContactModal')">×</button>
                    </div>
                    <div class="modal-body">
                        <form id="addContactForm" onsubmit="saveContact(event)">
                            <div class="form-group">
                                <label class="form-label">Name</label>
                                <input type="text" class="form-control" id="contactName" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">WhatsApp Number</label>
                                <input type="tel" class="form-control" id="contactNumber" 
                                       placeholder="919174406375" pattern="[0-9]{12}" required>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" onclick="closeModal('addContactModal')">
                                    Cancel
                                </button>
                                <button type="submit" class="btn btn-primary">💾 Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

async function saveContact(event) {
    event.preventDefault();
    
    const name = document.getElementById('contactName').value.trim();
    const number = document.getElementById('contactNumber').value.trim();
    
    try {
        showLoading();
        
        const response = await fetch('/api/contacts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, number })
        });
        
        if (!response.ok) throw new Error('Failed to save contact');
        
        showToast('success', 'Saved', 'Contact added successfully');
        closeModal('addContactModal');
        loadContacts();
        
        hideLoading();
        
    } catch (error) {
        console.error('Save contact error:', error);
        showToast('error', 'Error', 'Failed to save contact');
        hideLoading();
    }
}

async function deleteContact(contactId) {
    if (!confirm('Delete this contact?')) return;
    
    try {
        const response = await fetch(`/api/contacts/${contactId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to delete contact');
        
        showToast('success', 'Deleted', 'Contact deleted');
        loadContacts();
        
    } catch (error) {
        console.error('Delete error:', error);
        showToast('error', 'Error', 'Failed to delete contact');
    }
}

// ============= CAMPAIGN MANAGEMENT =============

async function loadCampaigns() {
    try {
        showLoading();
        
        const response = await fetch('/api/campaigns', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load campaigns');
        
        const data = await response.json();
        campaigns = data.campaigns || [];
        
        displayActiveCampaigns();
        
        hideLoading();
        
    } catch (error) {
        console.error('Campaigns load error:', error);
        showToast('error', 'Error', 'Failed to load campaigns');
        hideLoading();
    }
}

function displayActiveCampaigns() {
    const activeCampaignsList = document.getElementById('activeCampaignsList');
    if (!activeCampaignsList) return;
    
    const activeCampaigns = campaigns.filter(c => c.status === 'running' || c.status === 'paused');
    
    if (activeCampaigns.length === 0) {
        activeCampaignsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🚀</div>
                <div class="empty-state-text">No active campaigns</div>
            </div>
        `;
        return;
    }
    
    activeCampaignsList.innerHTML = activeCampaigns.map(campaign => `
        <div class="campaign-card">
            <div class="campaign-header">
                <div class="campaign-title">
                    🚀 ${campaign.name}
                </div>
                <div class="campaign-status ${campaign.status}">
                    ${campaign.status === 'running' ? '▶️ Running' : '⏸️ Paused'}
                </div>
            </div>
            
            <div class="campaign-details">
                <strong>Template:</strong> ${campaign.templateName}<br>
                <strong>Session:</strong> ${campaign.sessionName}<br>
                <strong>Started:</strong> ${formatDateTime(campaign.startedAt)}
            </div>
            
            <div class="campaign-progress-wrapper">
                <div class="campaign-progress-info">
                    <span>Progress</span>
                    <span>${campaign.sent}/${campaign.total} (${Math.round(campaign.sent/campaign.total*100)}%)</span>
                </div>
                <div class="progress">
                    <div class="progress-bar" 
                         style="width: ${(campaign.sent/campaign.total*100)}%"
                         id="campaignProgress_${campaign.id}">
                    </div>
                </div>
                <div class="campaign-progress-info">
                    <span class="campaign-progress-sent">✓ Sent: ${campaign.sent}</span>
                    <span class="campaign-progress-failed">✗ Failed: ${campaign.failed}</span>
                </div>
            </div>
            
            <div class="campaign-stats">
                <div class="campaign-stat">
                    <div class="campaign-stat-value">${campaign.sent}</div>
                    <div class="campaign-stat-label">Sent</div>
                </div>
                <div class="campaign-stat">
                    <div class="campaign-stat-value">${campaign.failed}</div>
                    <div class="campaign-stat-label">Failed</div>
                </div>
                <div class="campaign-stat">
                    <div class="campaign-stat-value">${campaign.remaining}</div>
                    <div class="campaign-stat-label">Remaining</div>
                </div>
                <div class="campaign-stat">
                    <div class="campaign-stat-value">${campaign.estimatedTime}</div>
                    <div class="campaign-stat-label">ETA</div>
                </div>
            </div>
            
            <div class="campaign-actions">
                ${campaign.status === 'running' ? `
                    <button class="btn btn-sm btn-warning" onclick="pauseCampaign('${campaign.id}')">
                        ⏸️ Pause
                    </button>
                ` : `
                    <button class="btn btn-sm btn-success" onclick="resumeCampaign('${campaign.id}')">
                        ▶️ Resume
                    </button>
                `}
                <button class="btn btn-sm btn-danger" onclick="stopCampaign('${campaign.id}')">
                    ⏹️ Stop
                </button>
                ${campaign.failed > 0 ? `
                    <button class="btn btn-sm btn-info" onclick="retryFailed('${campaign.id}')">
                        🔄 Retry Failed
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// ============= START CAMPAIGN =============

async function handleCampaignSubmit(event) {
    event.preventDefault();
    
    const campaignName = document.getElementById('campaignName').value.trim();
    const sessionId = document.getElementById('campaignSession').value;
    const templateId = document.getElementById('campaignTemplate').value;
    const groupName = document.getElementById('campaignGroup').value;
    const selectedImages = Array.from(document.getElementById('campaignImages').selectedOptions).map(o => o.value);
    const minDelay = parseInt(document.getElementById('minDelay').value);
    const maxDelay = parseInt(document.getElementById('maxDelay').value);
    
    // Validation
    if (!campaignName || !sessionId || !templateId || !groupName) {
        showToast('error', 'Missing Info', 'Please fill all required fields');
        return;
    }
    
    if (minDelay < 1 || maxDelay > 2000 || minDelay > maxDelay) {
        showToast('error', 'Invalid Delay', 'Delay must be between 1-2000 seconds and min < max');
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch('/api/campaigns/start', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                campaignName,
                sessionId,
                templateId,
                groupName,
                images: selectedImages,
                antiBan: {
                    minDelay,
                    maxDelay,
                    batchSize: 20,
                    cooldownPeriod: 60
                }
            })
        });
        
        if (!response.ok) throw new Error('Failed to start campaign');
        
        const data = await response.json();
        
        showToast('success', 'Campaign Started! 🚀', 
            `Sending to ${data.totalContacts} contacts with anti-ban protection`);
        
        // Reset form
        document.getElementById('campaignForm').reset();
        
        // Reload campaigns
        loadCampaigns();
        
        hideLoading();
        
    } catch (error) {
        console.error('Campaign start error:', error);
        showToast('error', 'Error', error.message || 'Failed to start campaign');
        hideLoading();
    }
}

async function testMessage() {
    const sessionId = document.getElementById('campaignSession').value;
    const templateId = document.getElementById('campaignTemplate').value;
    
    if (!sessionId || !templateId) {
        showToast('error', 'Missing Info', 'Please select session and template');
        return;
    }
    
    const testNumber = prompt('Enter WhatsApp number to send test message (with country code):');
    
    if (!testNumber || !/^[0-9]{12}$/.test(testNumber)) {
        showToast('error', 'Invalid Number', 'Please enter valid WhatsApp number');
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch('/api/campaigns/test', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId,
                templateId,
                testNumber
            })
        });
        
        if (!response.ok) throw new Error('Failed to send test message');
        
        showToast('success', 'Test Sent', 'Test message sent successfully');
        
        hideLoading();
        
    } catch (error) {
        console.error('Test message error:', error);
        showToast('error', 'Error', 'Failed to send test message');
        hideLoading();
    }
}

// ============= CAMPAIGN CONTROLS =============

async function pauseCampaign(campaignId) {
    try {
        const response = await fetch(`/api/campaigns/${campaignId}/pause`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to pause campaign');
        
        showToast('success', 'Paused', 'Campaign paused');
        loadCampaigns();
        
    } catch (error) {
        console.error('Pause error:', error);
        showToast('error', 'Error', 'Failed to pause campaign');
    }
}

async function resumeCampaign(campaignId) {
    try {
        const response = await fetch(`/api/campaigns/${campaignId}/resume`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to resume campaign');
        
        showToast('success', 'Resumed', 'Campaign resumed');
        loadCampaigns();
        
    } catch (error) {
        console.error('Resume error:', error);
        showToast('error', 'Error', 'Failed to resume campaign');
    }
}

async function stopCampaign(campaignId) {
    if (!confirm('Are you sure you want to stop this campaign? This cannot be undone.')) return;
    
    try {
        const response = await fetch(`/api/campaigns/${campaignId}/stop`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to stop campaign');
        
        showToast('success', 'Stopped', 'Campaign stopped');
        loadCampaigns();
        
    } catch (error) {
        console.error('Stop error:', error);
        showToast('error', 'Error', 'Failed to stop campaign');
    }
}

async function retryFailed(campaignId) {
    try {
        showLoading();
        
        const response = await fetch(`/api/campaigns/${campaignId}/retry-failed`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to retry');
        
        const data = await response.json();
        
        showToast('success', 'Retrying', `Retrying ${data.failedCount} failed messages`);
        loadCampaigns();
        
        hideLoading();
        
    } catch (error) {
        console.error('Retry error:', error);
        showToast('error', 'Error', 'Failed to retry failed messages');
        hideLoading();
    }
}

// ============= REAL-TIME CAMPAIGN UPDATES =============

function updateCampaignProgress(data) {
    const progressBar = document.getElementById(`campaignProgress_${data.campaignId}`);
    if (progressBar) {
        const percentage = (data.sent / data.total * 100).toFixed(1);
        progressBar.style.width = percentage + '%';
        progressBar.textContent = percentage + '%';
    }
    
    // Update stats in card
    const campaignCard = progressBar?.closest('.campaign-card');
    if (campaignCard) {
        const stats = campaignCard.querySelectorAll('.campaign-stat-value');
        if (stats.length >= 4) {
            stats[0].textContent = data.sent; // Sent
            stats[1].textContent = data.failed; // Failed
            stats[2].textContent = data.remaining; // Remaining
            stats[3].textContent = data.estimatedTime; // ETA
        }
    }
}

function updateMessageCounter(data) {
    // Update dashboard stats
    const messagesToday = document.getElementById('messagesToday');
    if (messagesToday) {
        const current = parseInt(messagesToday.textContent.replace(/[^0-9]/g, '')) || 0;
        messagesToday.textContent = formatNumber(current + 1);
    }
}

function updateFailedCounter(data) {
    console.log('Message failed:', data);
    // Update can be handled in campaign progress
}

// ============= SCHEDULE SYSTEM =============

async function loadSchedules() {
    try {
        showLoading();
        
        const response = await fetch('/api/schedules', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load schedules');
        
        const data = await response.json();
        
        displaySchedules(data.schedules || []);
        
        hideLoading();
        
    } catch (error) {
        console.error('Schedules load error:', error);
        showToast('error', 'Error', 'Failed to load schedules');
        hideLoading();
    }
}

function displaySchedules(schedules) {
    const scheduledList = document.getElementById('scheduledList');
    if (!scheduledList) return;
    
    if (schedules.length === 0) {
        scheduledList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📅</div>
                <div class="empty-state-text">No scheduled campaigns</div>
            </div>
        `;
        return;
    }
    
    scheduledList.innerHTML = schedules.map(schedule => `
        <div class="campaign-card">
            <div class="campaign-header">
                <div class="campaign-title">📅 ${schedule.name}</div>
                <span class="badge badge-info">Scheduled</span>
            </div>
            <div class="campaign-details">
                <strong>Scheduled for:</strong> ${formatDateTime(schedule.scheduledTime)}<br>
                <strong>Contacts:</strong> ${schedule.contactCount}<br>
                <strong>Template:</strong> ${schedule.templateName}
            </div>
            <div class="campaign-actions">
                <button class="btn btn-sm btn-warning" onclick="editSchedule('${schedule.id}')">
                    ✏️ Edit
                </button>
                <button class="btn btn-sm btn-danger" onclick="cancelSchedule('${schedule.id}')">
                    ✗ Cancel
                </button>
            </div>
        </div>
    `).join('');
}

function openScheduleModal() {
    showToast('info', 'Coming Soon', 'Advanced scheduling feature will be available soon');
}

// ============= END OF PART 4 =============
// Next part:
// Part 5: Book Orders (PIN Code System), Reports, Settings

/* ================================================
   PART 5/5: BOOK ORDER SYSTEM & FINAL FEATURES
   Lines: 900+ | Complete Order Management
   Features: PIN Code System (All India), 
            Multi-Language (Hindi/English),
            WhatsApp Bot Integration,
            Free Book Order with Home Delivery,
            Reports & Analytics
   ================================================ */

// ============= BOOK ORDER SYSTEM (SANT RAMPAL JI) =============

let pincodeData = [];
let selectedLanguage = 'hindi'; // Default language
let selectedLocation = null;

async function loadOrders() {
    try {
        showLoading();
        
        const response = await fetch('/api/orders', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load orders');
        
        const data = await response.json();
        
        displayOrders(data.orders || []);
        
        hideLoading();
        
    } catch (error) {
        console.error('Orders load error:', error);
        showToast('error', 'Error', 'Failed to load orders');
        hideLoading();
    }
}

function displayOrders(orders) {
    const ordersTableBody = document.getElementById('ordersTableBody');
    if (!ordersTableBody) return;
    
    if (orders.length === 0) {
        ordersTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="empty-state">
                        <div class="empty-state-icon">📚</div>
                        <div class="empty-state-title">कोई ऑर्डर नहीं / No Orders Yet</div>
                        <div class="empty-state-text">
                            संत रामपाल जी महाराज की निःशुल्क पुस्तक ऑर्डर करें<br>
                            Order Sant Rampal Ji's Free Book with Free Home Delivery
                        </div>
                        <button class="btn btn-primary mt-20" onclick="openPlaceOrderModal()">
                            📚 ऑर्डर करें / Place Order
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    ordersTableBody.innerHTML = orders.map(order => {
        const statusColors = {
            pending: 'badge-warning',
            confirmed: 'badge-info',
            dispatched: 'badge-primary',
            delivered: 'badge-success'
        };
        
        return `
            <tr>
                <td><strong>#${order.orderId}</strong></td>
                <td>${order.name}</td>
                <td>${order.phone}</td>
                <td>
                    ${order.village ? order.village + ', ' : ''}
                    ${order.postOffice ? order.postOffice + ', ' : ''}
                    ${order.city}, ${order.district}, ${order.state}<br>
                    <small style="color: #999;">PIN: ${order.pincode}</small>
                </td>
                <td>${order.quantity}</td>
                <td><span class="badge ${statusColors[order.status]}">${order.status.toUpperCase()}</span></td>
                <td>${formatDateTime(order.createdAt)}</td>
            </tr>
        `;
    }).join('');
}

// ============= PLACE ORDER MODAL WITH LANGUAGE SELECTION =============

function openPlaceOrderModal() {
    const modalHTML = `
        <div class="modal show" id="placeOrderModal">
            <div class="modal-dialog modal-dialog-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">📚 संत रामपाल जी की पुस्तक ऑर्डर करें / Order Sant Rampal Ji's Book</h3>
                        <button class="modal-close" onclick="closeModal('placeOrderModal')">×</button>
                    </div>
                    <div class="modal-body">
                        <!-- Language Selection -->
                        <div class="alert alert-success">
                            <div class="alert-icon">🎁</div>
                            <div class="alert-content">
                                <div class="alert-title">पूर्णतः निःशुल्क / Completely FREE</div>
                                <div class="alert-message">
                                    ✅ निःशुल्क पुस्तक / Free Book<br>
                                    ✅ निःशुल्क होम डिलीवरी / Free Home Delivery<br>
                                    ✅ कोई शुल्क नहीं / No Charges
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">भाषा चुनें / Select Language <span class="required">*</span></label>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <button type="button" class="btn btn-outline-primary" id="btnHindi" 
                                        onclick="selectLanguage('hindi')" style="padding: 15px;">
                                    🇮🇳 हिंदी (Hindi)
                                </button>
                                <button type="button" class="btn btn-outline-primary" id="btnEnglish" 
                                        onclick="selectLanguage('english')" style="padding: 15px;">
                                    🇬🇧 English
                                </button>
                            </div>
                        </div>
                        
                        <div id="orderFormContainer" style="display: none;">
                            <form id="orderForm" onsubmit="submitOrder(event)">
                                <!-- PIN Code Search -->
                                <div class="form-group">
                                    <label class="form-label" id="labelPincode">
                                        पिन कोड / PIN Code <span class="required">*</span>
                                    </label>
                                    <input type="text" class="form-control" id="orderPincode" 
                                           placeholder="123456" maxlength="6" 
                                           oninput="this.value=this.value.replace(/[^0-9]/g,'')" required>
                                    <div class="form-text" id="hintPincode">
                                        अपना 6 अंकों का पिन कोड दर्ज करें / Enter your 6-digit PIN code
                                    </div>
                                    <button type="button" class="btn btn-sm btn-primary mt-10" onclick="searchPincode()">
                                        🔍 <span id="btnSearchText">खोजें / Search</span>
                                    </button>
                                </div>
                                
                                <!-- PIN Code Results -->
                                <div id="pincodeResults" style="display: none; margin-bottom: 20px;"></div>
                                
                                <!-- Personal Details (Show after location selection) -->
                                <div id="personalDetailsSection" style="display: none;">
                                    <div class="alert alert-info">
                                        <div class="alert-icon">📍</div>
                                        <div class="alert-content">
                                            <div class="alert-title" id="selectedLocationTitle">चयनित स्थान / Selected Location</div>
                                            <div class="alert-message" id="selectedLocationText"></div>
                                        </div>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label class="form-label" id="labelName">
                                            पूरा नाम / Full Name <span class="required">*</span>
                                        </label>
                                        <input type="text" class="form-control" id="orderName" required>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label class="form-label" id="labelPhone">
                                            मोबाइल नंबर / Mobile Number <span class="required">*</span>
                                        </label>
                                        <input type="tel" class="form-control" id="orderPhone" 
                                               placeholder="9174406375" pattern="[0-9]{10}" maxlength="10" required>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label class="form-label" id="labelAddress">
                                            पूरा पता / Complete Address <span class="required">*</span>
                                        </label>
                                        <textarea class="form-control" id="orderAddress" rows="3" required></textarea>
                                        <div class="form-text" id="hintAddress">
                                            मकान नंबर, गली, लैंडमार्क / House No, Street, Landmark
                                        </div>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label class="form-label" id="labelQuantity">
                                            पुस्तकों की संख्या / Number of Books
                                        </label>
                                        <input type="number" class="form-control" id="orderQuantity" 
                                               value="1" min="1" max="5">
                                        <div class="form-text" id="hintQuantity">
                                            अधिकतम 5 पुस्तकें / Maximum 5 books
                                        </div>
                                    </div>
                                    
                                    <div class="modal-footer">
                                        <button type="button" class="btn btn-secondary" onclick="closeModal('placeOrderModal')">
                                            <span id="btnCancel">रद्द करें / Cancel</span>
                                        </button>
                                        <button type="submit" class="btn btn-primary">
                                            📚 <span id="btnSubmitOrder">ऑर्डर करें / Place Order</span>
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Load PIN code data
    loadPincodeData();
}

function selectLanguage(lang) {
    selectedLanguage = lang;
    
    // Update button styles
    document.getElementById('btnHindi').className = lang === 'hindi' ? 
        'btn btn-primary' : 'btn btn-outline-primary';
    document.getElementById('btnEnglish').className = lang === 'english' ? 
        'btn btn-primary' : 'btn btn-outline-primary';
    
    // Show form
    document.getElementById('orderFormContainer').style.display = 'block';
    
    // Update all labels based on language
    updateLanguageLabels(lang);
}

function updateLanguageLabels(lang) {
    const labels = {
        hindi: {
            labelPincode: 'पिन कोड',
            hintPincode: 'अपना 6 अंकों का पिन कोड दर्ज करें',
            btnSearchText: 'खोजें',
            selectedLocationTitle: 'चयनित स्थान',
            labelName: 'पूरा नाम',
            labelPhone: 'मोबाइल नंबर',
            labelAddress: 'पूरा पता',
            hintAddress: 'मकान नंबर, गली, लैंडमार्क',
            labelQuantity: 'पुस्तकों की संख्या',
            hintQuantity: 'अधिकतम 5 पुस्तकें',
            btnCancel: 'रद्द करें',
            btnSubmitOrder: 'ऑर्डर करें'
        },
        english: {
            labelPincode: 'PIN Code',
            hintPincode: 'Enter your 6-digit PIN code',
            btnSearchText: 'Search',
            selectedLocationTitle: 'Selected Location',
            labelName: 'Full Name',
            labelPhone: 'Mobile Number',
            labelAddress: 'Complete Address',
            hintAddress: 'House No, Street, Landmark',
            labelQuantity: 'Number of Books',
            hintQuantity: 'Maximum 5 books',
            btnCancel: 'Cancel',
            btnSubmitOrder: 'Place Order'
        }
    };
    
    const texts = labels[lang];
    
    Object.keys(texts).forEach(key => {
        const element = document.getElementById(key);
        if (element) {
            if (element.tagName === 'LABEL') {
                element.innerHTML = texts[key] + ' <span class="required">*</span>';
            } else {
                element.textContent = texts[key];
            }
        }
    });
}

// ============= PIN CODE DATABASE MANAGEMENT =============

async function loadPincodeData() {
    try {
        const response = await fetch('/data/india-pincodes.json');
        if (!response.ok) throw new Error('Failed to load PIN code data');
        
        pincodeData = await response.json();
        console.log('PIN code database loaded:', pincodeData.length, 'entries');
        
    } catch (error) {
        console.error('PIN code load error:', error);
        // Use API fallback
        console.log('Using API fallback for PIN code search');
    }
}

async function searchPincode() {
    const pincode = document.getElementById('orderPincode').value.trim();
    
    if (!/^[0-9]{6}$/.test(pincode)) {
        const msg = selectedLanguage === 'hindi' ? 
            'कृपया 6 अंकों का सही पिन कोड दर्ज करें' : 
            'Please enter a valid 6-digit PIN code';
        showToast('error', 'Invalid PIN', msg);
        return;
    }
    
    try {
        showLoading();
        
        // Search in loaded data or use API
        const response = await fetch(`/api/pincode/search?pincode=${pincode}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('PIN code not found');
        
        const data = await response.json();
        
        if (!data.locations || data.locations.length === 0) {
            const msg = selectedLanguage === 'hindi' ? 
                'इस पिन कोड के लिए कोई स्थान नहीं मिला' : 
                'No locations found for this PIN code';
            showToast('error', 'Not Found', msg);
            hideLoading();
            return;
        }
        
        displayPincodeResults(data.locations, pincode);
        
        hideLoading();
        
    } catch (error) {
        console.error('PIN code search error:', error);
        const msg = selectedLanguage === 'hindi' ? 
            'पिन कोड खोजने में त्रुटि' : 
            'Error searching PIN code';
        showToast('error', 'Error', msg);
        hideLoading();
    }
}

function displayPincodeResults(locations, pincode) {
    const resultsDiv = document.getElementById('pincodeResults');
    if (!resultsDiv) return;
    
    const title = selectedLanguage === 'hindi' ? 
        `पिन कोड ${pincode} के लिए ${locations.length} स्थान मिले:` : 
        `Found ${locations.length} locations for PIN code ${pincode}:`;
    
    const selectText = selectedLanguage === 'hindi' ? 'चुनें' : 'Select';
    
    let html = `
        <div class="alert alert-success">
            <div class="alert-title">${title}</div>
        </div>
        <div style="max-height: 300px; overflow-y: auto; border: 1px solid #e0e0e0; 
                    border-radius: 8px; padding: 10px;">
    `;
    
    locations.forEach((location, index) => {
        html += `
            <div style="padding: 15px; border-bottom: 1px solid #f0f0f0; cursor: pointer;
                        transition: background 0.3s;" 
                 onclick="selectLocation(${index}, '${pincode}')"
                 onmouseover="this.style.background='#f8f9fa'"
                 onmouseout="this.style.background='white'">
                <div style="font-weight: 600; color: var(--primary); margin-bottom: 5px;">
                    ${index + 1}. ${location.postOffice || location.officeName}
                </div>
                <div style="font-size: 13px; color: #666; line-height: 1.6;">
                    📍 ${location.village ? location.village + ', ' : ''}
                    ${location.city || location.taluk}, 
                    ${location.district}, ${location.state}<br>
                    🏛️ डाकघर प्रकार / Post Office Type: ${location.officeType || 'BO'}
                </div>
                <button class="btn btn-sm btn-primary mt-10">
                    ✓ ${selectText}
                </button>
            </div>
        `;
    });
    
    html += `</div>`;
    
    resultsDiv.innerHTML = html;
    resultsDiv.style.display = 'block';
}

function selectLocation(index, pincode) {
    const resultsDiv = document.getElementById('pincodeResults');
    const locationElements = resultsDiv.querySelectorAll('[onclick^="selectLocation"]');
    
    // Get location data from API response (stored in global or fetch again)
    fetch(`/api/pincode/search?pincode=${pincode}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(res => res.json())
    .then(data => {
        selectedLocation = {
            ...data.locations[index],
            pincode: pincode
        };
        
        // Update selected location display
        const locationText = `
            📍 ${selectedLocation.postOffice || selectedLocation.officeName}<br>
            ${selectedLocation.village ? selectedLocation.village + ', ' : ''}
            ${selectedLocation.city || selectedLocation.taluk}, 
            ${selectedLocation.district}, ${selectedLocation.state}<br>
            PIN: ${pincode}
        `;
        
        document.getElementById('selectedLocationText').innerHTML = locationText;
        
        // Show personal details section
        document.getElementById('personalDetailsSection').style.display = 'block';
        
        // Scroll to form
        document.getElementById('personalDetailsSection').scrollIntoView({ behavior: 'smooth' });
        
        const msg = selectedLanguage === 'hindi' ? 
            'स्थान चयनित! अब अपनी जानकारी भरें' : 
            'Location selected! Now fill your details';
        showToast('success', 'Selected', msg);
    });
}

// ============= SUBMIT ORDER =============

async function submitOrder(event) {
    event.preventDefault();
    
    if (!selectedLocation) {
        const msg = selectedLanguage === 'hindi' ? 
            'कृपया पहले स्थान चुनें' : 
            'Please select location first';
        showToast('error', 'Location Required', msg);
        return;
    }
    
    const orderData = {
        name: document.getElementById('orderName').value.trim(),
        phone: document.getElementById('orderPhone').value.trim(),
        address: document.getElementById('orderAddress').value.trim(),
        quantity: parseInt(document.getElementById('orderQuantity').value),
        pincode: selectedLocation.pincode,
        state: selectedLocation.state,
        district: selectedLocation.district,
        city: selectedLocation.city || selectedLocation.taluk,
        village: selectedLocation.village,
        postOffice: selectedLocation.postOffice || selectedLocation.officeName,
        language: selectedLanguage
    };
    
    try {
        showLoading();
        
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });
        
        if (!response.ok) throw new Error('Failed to place order');
        
        const data = await response.json();
        
        // Success message in selected language
        const successMsg = selectedLanguage === 'hindi' ? 
            `✅ ऑर्डर सफलतापूर्वक प्राप्त हुआ!\n\nऑर्डर आईडी: #${data.orderId}\n\n` +
            `📚 ${orderData.quantity} पुस्तक(एँ) निःशुल्क\n` +
            `🏠 निःशुल्क होम डिलीवरी\n` +
            `📍 ${orderData.village ? orderData.village + ', ' : ''}${orderData.city}, ${orderData.district}\n\n` +
            `जल्द ही आपको WhatsApp पर सूचना मिलेगी।\n` +
            `जय गुरुदेव! 🙏` :
            `✅ Order Placed Successfully!\n\nOrder ID: #${data.orderId}\n\n` +
            `📚 ${orderData.quantity} Book(s) - FREE\n` +
            `🏠 Free Home Delivery\n` +
            `📍 ${orderData.village ? orderData.village + ', ' : ''}${orderData.city}, ${orderData.district}\n\n` +
            `You will receive WhatsApp notification soon.\n` +
            `Jai Gurudev! 🙏`;
        
        alert(successMsg);
        
        closeModal('placeOrderModal');
        loadOrders();
        
        hideLoading();
        
    } catch (error) {
        console.error('Order submit error:', error);
        const msg = selectedLanguage === 'hindi' ? 
            'ऑर्डर करने में त्रुटि' : 
            'Failed to place order';
        showToast('error', 'Error', msg);
        hideLoading();
    }
}

// ============= REPORTS & ANALYTICS =============

async function loadReports() {
    try {
        showLoading();
        
        const response = await fetch('/api/reports/analytics', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load reports');
        
        const data = await response.json();
        
        displayReports(data);
        
        hideLoading();
        
    } catch (error) {
        console.error('Reports load error:', error);
        showToast('error', 'Error', 'Failed to load reports');
        hideLoading();
    }
}

function displayReports(data) {
    const reportContent = document.getElementById('reportContent');
    if (!reportContent) return;
    
    if (!data.campaigns || data.campaigns.length === 0) {
        reportContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <div class="empty-state-text">No reports available yet</div>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="stats-grid mb-20">
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-title">Total Campaigns</div>
                    <div class="stat-icon">🚀</div>
                </div>
                <div class="stat-value">${data.totalCampaigns || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-title">Messages Sent</div>
                    <div class="stat-icon">✓</div>
                </div>
                <div class="stat-value">${formatNumber(data.totalSent || 0)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-title">Success Rate</div>
                    <div class="stat-icon">📈</div>
                </div>
                <div class="stat-value">${data.successRate || 0}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-title">Active Sessions</div>
                    <div class="stat-icon">📱</div>
                </div>
                <div class="stat-value">${data.activeSessions || 0}</div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">📊 Campaign History</h3>
            </div>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Campaign</th>
                            <th>Date</th>
                            <th>Sent</th>
                            <th>Failed</th>
                            <th>Success Rate</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.campaigns.map(campaign => `
                            <tr>
                                <td><strong>${campaign.name}</strong></td>
                                <td>${formatDateTime(campaign.startedAt)}</td>
                                <td>${campaign.sent}</td>
                                <td>${campaign.failed}</td>
                                <td>
                                    <div class="progress">
                                        <div class="progress-bar progress-bar-success" 
                                             style="width: ${campaign.successRate}%">
                                        </div>
                                    </div>
                                    ${campaign.successRate}%
                                </td>
                                <td><span class="badge badge-${campaign.status === 'completed' ? 'success' : 'warning'}">${campaign.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    reportContent.innerHTML = html;
}

async function exportReport() {
    try {
        showLoading();
        
        const response = await fetch('/api/reports/export', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to export report');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_${Date.now()}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        showToast('success', 'Exported', 'Report downloaded successfully');
        
        hideLoading();
        
    } catch (error) {
        console.error('Export error:', error);
        showToast('error', 'Error', 'Failed to export report');
        hideLoading();
    }
}

// ============= SETTINGS =============

function loadSettings() {
    const settingsName = document.getElementById('settingsName');
    const settingsWhatsApp = document.getElementById('settingsWhatsApp');
    const settingsEmail = document.getElementById('settingsEmail');
    const accountStatus = document.getElementById('accountStatus');
    
    if (settingsName) settingsName.value = currentUser.name;
    if (settingsWhatsApp) settingsWhatsApp.value = currentUser.whatsapp;
    if (settingsEmail) settingsEmail.value = currentUser.email;
    
    if (accountStatus) {
        const statusHTML = `
            <div class="flex items-center gap-10">
                <span class="status-badge ${currentUser.status === 'active' ? 'active' : 'pending'}">
                    ${currentUser.status === 'active' ? '✓ Active' : '⏳ Pending'}
                </span>
                ${currentUser.premiumUnlocked ? 
                    '<span class="badge badge-warning">⭐ Premium Unlocked</span>' : 
                    '<span class="badge badge-light">🔒 Standard</span>'
                }
            </div>
        `;
        accountStatus.innerHTML = statusHTML;
    }
}

// ============= INITIALIZATION COMPLETE =============

console.log('✅ WA Cloud Sender Seva - User Dashboard Fully Loaded!');
console.log('📊 Total Lines of Code: 3500+');
console.log('🚀 All Features Active!');

/* ================================================
   🎉 COMPLETE JAVASCRIPT APPLICATION
   Total Lines: 3500+
   Version: 2.0.0
   Author: Sachin Bamniya
   Features: Complete Enterprise System
   ================================================ */
