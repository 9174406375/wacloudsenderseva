#!/bin/bash

echo "🔄 WA Cloud Sender - Restart Script"
echo "═══════════════════════════════════════════════════════════"

# Kill all node processes
echo "🛑 Stopping old server..."
killall node 2>/dev/null
pkill -f "node server" 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null

sleep 2

# Check if port is free
if lsof -i:3000 > /dev/null 2>&1; then
    echo "⚠️  Port 3000 still in use, force killing..."
    fuser -k 3000/tcp 2>/dev/null
    sleep 1
fi

echo "✅ Port 3000 is now free"
echo ""

# Check MongoDB
echo "🔍 Checking MongoDB..."
if pgrep -x "mongod" > /dev/null; then
    echo "✅ MongoDB is running"
else
    echo "⚠️  MongoDB not running"
    
    if command -v mongod &> /dev/null; then
        echo "📦 Starting MongoDB..."
        mkdir -p ~/mongodb-data
        mongod --dbpath ~/mongodb-data --port 27017 --bind_ip 127.0.0.1 --fork --logpath ~/mongodb-data/mongodb.log
        sleep 2
        echo "✅ MongoDB started"
    else
        echo "⚠️  MongoDB not installed (using Atlas)"
    fi
fi

echo ""
echo "🚀 Starting server..."
echo "═══════════════════════════════════════════════════════════"
echo ""

node server.js
