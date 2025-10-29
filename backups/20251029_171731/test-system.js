/**
 * ═══════════════════════════════════════════════════════════════
 * SYSTEM TEST & ERROR CHECKING SCRIPT
 * ═══════════════════════════════════════════════════════════════
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('🔍 Running System Tests & Error Checks...\n');

let errors = [];
let warnings = [];
let passed = 0;

// Test 1: Check required files
console.log('📁 Test 1: Checking required files...');
const requiredFiles = [
    'server.js',
    'package.json',
    '.env',
    'config/database.js',
    'models/User.js',
    'models/Campaign.js',
    'models/Contact.js',
    'models/ContactList.js',
    'models/Order.js',
    'services/whatsappService.js',
    'services/messageService.js',
    'services/schedulerService.js',
    'services/orderService.js',
    'services/folderWatchService.js',
    'routes/auth.js',
    'routes/campaigns.js',
    'routes/contacts.js',
    'routes/lists.js',
    'routes/whatsapp.js',
    'routes/orders.js',
    'middleware/auth.js',
    'public/index.html',
    'public/dashboard.html',
    'public/create-campaign.html'
];

requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`   ✅ ${file}`);
        passed++;
    } else {
        console.log(`   ❌ ${file} - MISSING!`);
        errors.push(`Missing file: ${file}`);
    }
});

// Test 2: Check environment variables
console.log('\n🔐 Test 2: Checking environment variables...');
const requiredEnvVars = [
    'MONGODB_URI',
    'JWT_SECRET',
    'ADMIN_EMAIL',
    'ADMIN_PHONE',
    'ADMIN_WHATSAPP'
];

requiredEnvVars.forEach(envVar => {
    if (process.env[envVar]) {
        console.log(`   ✅ ${envVar}`);
        passed++;
    } else {
        console.log(`   ⚠️  ${envVar} - NOT SET`);
        warnings.push(`Missing env variable: ${envVar}`);
    }
});

// Test 3: Check MongoDB connection string
console.log('\n🗄️  Test 3: Checking MongoDB URI...');
if (process.env.MONGODB_URI) {
    if (process.env.MONGODB_URI.includes('mongodb+srv://')) {
        console.log('   ✅ MongoDB URI format valid');
        passed++;
    } else {
        console.log('   ⚠️  MongoDB URI format may be invalid');
        warnings.push('MongoDB URI should start with mongodb+srv://');
    }
} else {
    console.log('   ❌ MongoDB URI not set');
    errors.push('MONGODB_URI not configured');
}

// Test 4: Check package.json dependencies
console.log('\n📦 Test 4: Checking dependencies...');
try {
    const pkg = require('./package.json');
    const requiredDeps = [
        'express',
        'mongoose',
        'socket.io',
        '@whiskeysockets/baileys',
        'qrcode',
        'xlsx',
        'multer',
        'chokidar'
    ];

    requiredDeps.forEach(dep => {
        if (pkg.dependencies[dep]) {
            console.log(`   ✅ ${dep}`);
            passed++;
        } else {
            console.log(`   ❌ ${dep} - NOT INSTALLED`);
            errors.push(`Missing dependency: ${dep}`);
        }
    });
} catch (error) {
    console.log('   ❌ Cannot read package.json');
    errors.push('package.json error: ' + error.message);
}

// Test 5: Check folder structure
console.log('\n📂 Test 5: Checking folder structure...');
const requiredFolders = [
    'config',
    'models',
    'routes',
    'services',
    'middleware',
    'public',
    'whatsapp-sessions',
    'uploads',
    'watch-folder'
];

requiredFolders.forEach(folder => {
    if (fs.existsSync(folder)) {
        console.log(`   ✅ ${folder}/`);
        passed++;
    } else {
        console.log(`   ⚠️  ${folder}/ - Creating...`);
        try {
            fs.mkdirSync(folder, { recursive: true });
            console.log(`   ✅ Created ${folder}/`);
            passed++;
        } catch (error) {
            errors.push(`Cannot create folder: ${folder}`);
        }
    }
});

// Final Report
console.log('\n' + '═'.repeat(70));
console.log('📊 TEST RESULTS');
console.log('═'.repeat(70));
console.log(`✅ Passed: ${passed}`);
console.log(`⚠️  Warnings: ${warnings.length}`);
console.log(`❌ Errors: ${errors.length}`);

if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach(w => console.log(`   • ${w}`));
}

if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.forEach(e => console.log(`   • ${e}`));
    console.log('\n❌ Please fix errors before starting server!');
    process.exit(1);
} else {
    console.log('\n✅ ALL TESTS PASSED! System ready to start.');
    console.log('Run: node server.js\n');
}
