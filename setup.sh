#!/bin/bash

echo "🧹 Cleaning old files..."
rm -f whatsapp.js bulk-sender.js routes.js server.js
rm -rf public

echo "📁 Creating folders..."
mkdir -p public/css public/js public/uploads

echo "✅ Setup complete! Folders created:"
ls -R
