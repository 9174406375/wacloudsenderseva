#!/bin/bash

echo "🔨 Building WA Cloud Sender Seva for Render..."

# Install dependencies
npm install --production

# Create necessary directories
mkdir -p whatsapp-sessions
mkdir -p uploads
mkdir -p logs

echo "✅ Build complete!"
