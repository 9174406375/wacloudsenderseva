module.exports = {
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'production',
    
    ADMIN: {
        mainWhatsApp: '919174406375', // MAIN ADMIN - only this sends credentials
        name: 'Sachin bamniya',
        email: 'sachinbamniya0143@gmail.com',
        password: 'CloudSeva@2025',
        activationCode: 'Satguru@5505', // Unlock code for premium features
        secondaryAdmins: [] // Can be added via main admin
    },
    
    LIMITS: {
        dailyMessages: 100000000000,
        delayMin: 1,
        delayMax: 2000,
        maxTemplates: 100,
        maxImages: 1000,
        maxWhatsAppSessions: 999, // Unlimited sessions per user
        maxFileSize: 50 * 1024 * 1024,
        maxGroupFetch: 100 // Max groups to fetch at once
    },
    
    DATABASE_PATH: './data/wacloudsender.db',
    SESSION_SECRET: 'wacloudsenderseva-ultra-2025',
    SESSION_MAX_AGE: 7 * 24 * 60 * 60 * 1000,
    
    WHATSAPP: {
        browserName: 'WA Cloud Sender',
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        allowMultipleSessions: true
    },
    
    ANTIBAN: {
        useRandomDelay: true,
        useNumberRotation: true,
        useTemplateRotation: true,
        useImageRotation: true,
        maxConsecutiveMessages: 20,
        cooldownAfterBatch: 60,
        randomizeOrder: true
    },
    
    PREMIUM_FEATURES: {
        presetTemplates: true, // Admin pre-set templates
        presetImages: true, // Admin pre-set images
        unlockCode: 'Satguru@5505',
        groupExtraction: true,
        scheduleSystem: true,
        contactSplitting: true
    },
    
    SCHEDULE: {
        enabled: true,
        autoSplitContacts: true,
        allowDateSelection: true,
        defaultSplitSize: 40 // Default contacts per day
    }
};
