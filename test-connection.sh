#!/bin/bash

echo "🧪 MONGODB CONNECTION TEST"
echo "═══════════════════════════════════════════════════════════"

# Kill old server
echo "🛑 Stopping old server..."
killall node 2>/dev/null
sleep 2

# Show MongoDB URI (hide password)
echo ""
echo "📝 MongoDB Configuration:"
grep MONGODB_URI .env | sed 's/:Wacloud2025/:****/g'

echo ""
echo "🚀 Starting server..."
echo "═══════════════════════════════════════════════════════════"
echo ""

# Start server and capture output
timeout 15 node server.js 2>&1 | tee server-test.log &

# Wait for startup
sleep 8

# Check if MongoDB connected
if grep -q "MongoDB connected successfully" server-test.log; then
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "✅ SUCCESS! MongoDB Connected!"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "Next steps:"
    echo "1. Test API: curl http://localhost:3000/health"
    echo "2. Create first user: curl -X POST http://localhost:3000/api/auth/register ..."
    echo ""
else
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "❌ FAILED! Check errors above"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "Common issues:"
    echo "1. Check username/password in .env"
    echo "2. Verify IP 0.0.0.0/0 is whitelisted in Atlas"
    echo "3. Wait 2-3 minutes after Atlas changes"
    echo ""
fi
