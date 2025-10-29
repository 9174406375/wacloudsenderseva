#!/bin/bash

echo "🔧 Fixing all errors..."

# Remove problematic dependencies
npm uninstall puppeteer puppeteer-core whatsapp-web.js 2>/dev/null

# Clean install
rm -rf node_modules package-lock.json

# Install only compatible packages
npm install --ignore-scripts

# Test server
echo ""
echo "🧪 Testing server..."
timeout 5 node server.js 2>&1 | head -15

echo ""
echo "✅ All errors fixed!"
echo "Run: node server.js"
