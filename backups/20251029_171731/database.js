const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const config = require('./config');

fs.ensureDirSync('./data');
const db = new Database(config.DATABASE_PATH);
db.pragma('journal_mode = WAL');

function initDB() {
    // Users table
    db.exec(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE NOT NULL,
        whatsapp_number TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        email TEXT,
        role TEXT DEFAULT 'user',
        status TEXT DEFAULT 'pending',
        premium_unlocked INTEGER DEFAULT 0,
        daily_limit INTEGER DEFAULT 500,
        messages_sent_today INTEGER DEFAULT 0,
        total_messages_sent INTEGER DEFAULT 0,
        last_reset_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        activated_by TEXT
    )`);

    // WhatsApp sessions - multiple per user
    db.exec(`CREATE TABLE IF NOT EXISTS whatsapp_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_name TEXT NOT NULL,
        qr_code TEXT,
        pairing_code TEXT,
        status TEXT DEFAULT 'disconnected',
        phone_number TEXT,
        device_name TEXT,
        is_primary INTEGER DEFAULT 0,
        last_connected DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(user_id, session_name)
    )`);

    // Admin preset templates
    db.exec(`CREATE TABLE IF NOT EXISTS admin_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        message TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        variables TEXT,
        is_active INTEGER DEFAULT 1,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // User templates
    db.exec(`CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        message TEXT NOT NULL,
        variables TEXT,
        category TEXT DEFAULT 'general',
        is_active INTEGER DEFAULT 1,
        use_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`);

    // Admin preset images
    db.exec(`CREATE TABLE IF NOT EXISTS admin_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        original_name TEXT,
        path TEXT NOT NULL,
        size INTEGER,
        mime_type TEXT,
        rotation_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // User images
    db.exec(`CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT,
        path TEXT NOT NULL,
        size INTEGER,
        mime_type TEXT,
        rotation_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        use_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`);

    // Groups table - fetched from WhatsApp
    db.exec(`CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_id INTEGER NOT NULL,
        group_jid TEXT NOT NULL,
        group_name TEXT,
        participant_count INTEGER DEFAULT 0,
        extracted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES whatsapp_sessions (id) ON DELETE CASCADE,
        UNIQUE(user_id, group_jid)
    )`);

    // Extracted contacts from groups
    db.exec(`CREATE TABLE IF NOT EXISTS group_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        phone_number TEXT NOT NULL,
        name TEXT,
        is_admin INTEGER DEFAULT 0,
        extracted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE
    )`);

    // Campaigns with schedule support
    db.exec(`CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        template_id INTEGER,
        total_contacts INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        pending_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        is_scheduled INTEGER DEFAULT 0,
        schedule_type TEXT DEFAULT 'immediate',
        delay_min INTEGER DEFAULT 1,
        delay_max INTEGER DEFAULT 2000,
        use_images INTEGER DEFAULT 0,
        use_admin_preset INTEGER DEFAULT 0,
        use_template_rotation INTEGER DEFAULT 0,
        use_image_rotation INTEGER DEFAULT 1,
        started_at DATETIME,
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (template_id) REFERENCES templates (id)
    )`);

    // Schedule splits - for automatic date-based sending
    db.exec(`CREATE TABLE IF NOT EXISTS schedule_splits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER NOT NULL,
        schedule_date TEXT NOT NULL,
        contact_count INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        started_at DATETIME,
        completed_at DATETIME,
        FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE
    )`);

    // Contacts for campaigns
    db.exec(`CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        campaign_id INTEGER,
        schedule_split_id INTEGER,
        phone_number TEXT NOT NULL,
        name TEXT,
        group_name TEXT,
        status TEXT DEFAULT 'pending',
        template_used TEXT,
        image_used TEXT,
        sent_at DATETIME,
        error_message TEXT,
        scheduled_for TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE,
        FOREIGN KEY (schedule_split_id) REFERENCES schedule_splits (id)
    )`);

    // Admin users - secondary admins
    db.exec(`CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        whatsapp_number TEXT UNIQUE NOT NULL,
        name TEXT,
        permissions TEXT,
        granted_by TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Activity logs
    db.exec(`CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
    )`);

    // WhatsApp bot commands log
    db.exec(`CREATE TABLE IF NOT EXISTS bot_commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_number TEXT NOT NULL,
        command TEXT NOT NULL,
        parameters TEXT,
        response TEXT,
        status TEXT DEFAULT 'executed',
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create indexes
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_whatsapp ON users(whatsapp_number)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON whatsapp_sessions(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_templates_user ON templates(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_contacts_campaign ON contacts(campaign_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_contacts_schedule ON contacts(schedule_split_id)`);

    // Create main admin
    const mainAdmin = db.prepare('SELECT id FROM users WHERE whatsapp_number = ?').get('admin');
    if (!mainAdmin) {
        const hashedPwd = bcrypt.hashSync(config.ADMIN.password, 10);
        db.prepare(`INSERT INTO users (uuid, whatsapp_number, password, name, email, role, status, premium_unlocked, daily_limit)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            uuidv4(), 'admin', hashedPwd, config.ADMIN.name, config.ADMIN.email, 
            'admin', 'active', 1, config.LIMITS.dailyMessages
        );
        console.log(`✅ Main Admin Created - Username: admin | Password: ${config.ADMIN.password}`);
    }

    console.log('✅ Database initialized with all tables');
}

// User operations
const userDB = {
    create: (whatsappNumber, name = '', email = '') => {
        const uuid = uuidv4();
        const password = 'WA' + Math.random().toString(36).slice(-8).toUpperCase();
        const hashedPassword = bcrypt.hashSync(password, 10);
        
        const result = db.prepare(`INSERT INTO users (uuid, whatsapp_number, password, name, email)
            VALUES (?, ?, ?, ?, ?)`).run(uuid, whatsappNumber, hashedPassword, name, email);
        
        return { id: result.lastInsertRowid, uuid, password, whatsappNumber, name, email };
    },

    authenticate: (number, password) => {
        const user = db.prepare('SELECT * FROM users WHERE whatsapp_number = ?').get(number);
        if (user && bcrypt.compareSync(password, user.password)) {
            db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(new Date().toISOString(), user.id);
            return user;
        }
        return null;
    },

    findById: (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id),
    
    findByNumber: (number) => db.prepare('SELECT * FROM users WHERE whatsapp_number = ?').get(number),
    
    getAll: () => db.prepare('SELECT * FROM users WHERE role != ? ORDER BY created_at DESC').all('admin'),
    
    updateStatus: (id, status) => db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id),
    
    unlockPremium: (id) => db.prepare('UPDATE users SET premium_unlocked = 1 WHERE id = ?').run(id),
    
    incrementMessage: (id) => db.prepare('UPDATE users SET messages_sent_today = messages_sent_today + 1, total_messages_sent = total_messages_sent + 1 WHERE id = ?').run(id)
};

// WhatsApp session operations
const sessionDB = {
    create: (userId, sessionName, phoneNumber = null) => {
        return db.prepare(`INSERT INTO whatsapp_sessions (user_id, session_name, phone_number, status)
            VALUES (?, ?, ?, ?)`).run(userId, sessionName, phoneNumber, 'disconnected');
    },

    getByUser: (userId) => db.prepare('SELECT * FROM whatsapp_sessions WHERE user_id = ? ORDER BY is_primary DESC, created_at DESC').all(userId),
    
    updateStatus: (id, status, phoneNumber = null) => {
        return db.prepare('UPDATE whatsapp_sessions SET status = ?, phone_number = ?, last_connected = ? WHERE id = ?')
            .run(status, phoneNumber, new Date().toISOString(), id);
    },

    saveQR: (id, qr) => db.prepare('UPDATE whatsapp_sessions SET qr_code = ? WHERE id = ?').run(qr, id),
    
    savePairingCode: (id, code) => db.prepare('UPDATE whatsapp_sessions SET pairing_code = ? WHERE id = ?').run(code, id)
};

module.exports = { initDB, db, userDB, sessionDB };
