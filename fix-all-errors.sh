#!/bin/bash

echo "🔧 COMPLETE ERROR FIX SCRIPT"
echo "═══════════════════════════════════════════════════════════"

# Kill all node processes (multiple methods)
echo "🛑 Killing all node processes..."
killall -9 node 2>/dev/null
pkill -9 -f "node server" 2>/dev/null
ps aux | grep "[n]ode server.js" | awk '{print $2}' | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
fuser -k 3000/tcp 2>/dev/null

sleep 3

# Verify port is free
echo "🔍 Checking port 3000..."
if netstat -tuln | grep -q ":3000 "; then
    echo "⚠️  Port 3000 still in use!"
    echo "Trying alternative methods..."
    
    # Find exact PID using port 3000
    PID=$(lsof -ti:3000)
    if [ ! -z "$PID" ]; then
        echo "Killing PID: $PID"
        kill -9 $PID
        sleep 2
    fi
else
    echo "✅ Port 3000 is free"
fi

echo ""
echo "🚀 Starting server..."
echo "═══════════════════════════════════════════════════════════"
echo ""

# Start server
node server.js
