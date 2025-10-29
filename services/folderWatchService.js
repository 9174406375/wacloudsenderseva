/**
 * ═══════════════════════════════════════════════════════════════
 * FOLDER WATCH SERVICE - Auto-Execute on File Drop
 * Termux folder monitoring for auto-execution
 * ═══════════════════════════════════════════════════════════════
 */

const chokidar = require('chokidar');
const fs = require('fs-extra');
const path = require('path');

const WATCH_FOLDER = process.env.WATCH_FOLDER || './watch-folder';
const PROCESSED_FOLDER = path.join(WATCH_FOLDER, 'processed');
const ERROR_FOLDER = path.join(WATCH_FOLDER, 'errors');

/**
 * Initialize folder watcher
 */
async function initializeFolderWatch(io) {
    try {
        // Create folders
        await fs.ensureDir(WATCH_FOLDER);
        await fs.ensureDir(PROCESSED_FOLDER);
        await fs.ensureDir(ERROR_FOLDER);

        console.log(`👁️  Watching folder: ${WATCH_FOLDER}`);

        // Watch for new files
        const watcher = chokidar.watch(WATCH_FOLDER, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true
        });

        // File added event
        watcher.on('add', async (filePath) => {
            console.log(`📁 New file detected: ${filePath}`);
            await processFile(filePath, io);
        });

        return { success: true, watcher };

    } catch (error) {
        console.error('❌ Folder watch failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Process uploaded file
 */
async function processFile(filePath, io) {
    try {
        const fileName = path.basename(filePath);
        const ext = path.extname(fileName).toLowerCase();

        console.log(`🔄 Processing: ${fileName}`);

        // Handle different file types
        if (ext === '.xlsx' || ext === '.csv') {
            // Auto-import contacts
            await autoImportContacts(filePath, io);
        } else if (ext === '.json') {
            // Auto-create campaign from JSON
            await autoCreateCampaign(filePath, io);
        } else if (ext === '.txt') {
            // Bulk phone numbers
            await autoImportPhoneNumbers(filePath, io);
        }

        // Move to processed folder
        const processedPath = path.join(PROCESSED_FOLDER, fileName);
        await fs.move(filePath, processedPath, { overwrite: true });

        console.log(`✅ Processed: ${fileName}`);

    } catch (error) {
        console.error(`❌ Processing failed: ${error.message}`);
        
        // Move to error folder
        const errorPath = path.join(ERROR_FOLDER, path.basename(filePath));
        await fs.move(filePath, errorPath, { overwrite: true });
    }
}

/**
 * Auto-import contacts from Excel/CSV
 */
async function autoImportContacts(filePath, io) {
    const xlsx = require('xlsx');
    const Contact = require('../models/Contact');

    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let imported = 0;

    for (const row of data) {
        try {
            await Contact.create({
                name: row.name || row.Name,
                phone: String(row.phone || row.Phone),
                email: row.email || row.Email,
                location: {
                    city: row.city || row.City,
                    village: row.village || row.Village,
                    pincode: row.pincode || row.Pincode
                }
            });
            imported++;
        } catch (error) {
            console.error('Import error:', error.message);
        }
    }

    console.log(`✅ Auto-imported ${imported} contacts`);

    // Notify via Socket.IO
    if (io) {
        io.emit('folder:import:completed', {
            type: 'contacts',
            imported,
            file: path.basename(filePath)
        });
    }
}

/**
 * Auto-create campaign from JSON
 */
async function autoCreateCampaign(filePath, io) {
    const Campaign = require('../models/Campaign');
    
    const campaignData = await fs.readJSON(filePath);

    const campaign = await Campaign.create(campaignData);

    console.log(`✅ Auto-created campaign: ${campaign.name}`);

    if (io) {
        io.emit('folder:campaign:created', {
            campaignId: campaign._id,
            name: campaign.name
        });
    }
}

/**
 * Auto-import phone numbers from TXT
 */
async function autoImportPhoneNumbers(filePath, io) {
    const Contact = require('../models/Contact');
    
    const content = await fs.readFile(filePath, 'utf-8');
    const phones = content.split('\n').filter(p => p.trim());

    let imported = 0;

    for (const phone of phones) {
        try {
            await Contact.create({
                name: 'Imported Contact',
                phone: phone.trim()
            });
            imported++;
        } catch (error) {
            console.error('Import error:', error.message);
        }
    }

    console.log(`✅ Auto-imported ${imported} phone numbers`);

    if (io) {
        io.emit('folder:phones:imported', {
            imported,
            file: path.basename(filePath)
        });
    }
}

module.exports = {
    initializeFolderWatch,
    processFile
};
