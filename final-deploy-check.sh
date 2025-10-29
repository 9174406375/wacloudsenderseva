#!/bin/bash

echo "🔍 FINAL DEPLOYMENT CHECKLIST"
echo "=============================="

# 1. Check files
echo ""
echo "📁 Core Files:"
[ -f "server.js" ] && echo "✅ server.js" || echo "❌ Missing server.js"
[ -f "package.json" ] && echo "✅ package.json" || echo "❌ Missing package.json"
[ -f ".env" ] && echo "✅ .env" || echo "❌ Missing .env"
[ -f "config/passport.js" ] && echo "✅ passport.js" || echo "❌ Missing passport.js"
[ -f "models/User.js" ] && echo "✅ User.js" || echo "❌ Missing User.js"

# 2. Check .env values
echo ""
echo "⚙️ Environment Variables:"
grep -q "776351255401" .env && echo "✅ Google Client ID set" || echo "⚠️ Google Client ID missing"
grep -q "GOCSPX-" .env && echo "✅ Google Client Secret set" || echo "⚠️ Google Client Secret missing"
grep -q "mongodb+srv://" .env && echo "✅ MongoDB URI set" || echo "⚠️ MongoDB URI missing"

# 3. Test local server
echo ""
echo "🧪 Testing local server..."
timeout 5 node server.js &
SERVER_PID=$!
sleep 3

if curl -s http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ Local server working!"
else
    echo "⚠️ Local server test failed"
fi

kill $SERVER_PID 2>/dev/null

# 4. Git status
echo ""
echo "🔀 Git Status:"
git status | grep "nothing to commit" && echo "✅ All committed" || echo "⚠️ Uncommitted changes"

# 5. Railway check
echo ""
echo "🚂 Railway Status:"
railway status 2>/dev/null && echo "✅ Railway connected" || echo "⚠️ Railway not configured"

echo ""
echo "=============================="
echo "📋 PENDING TASKS:"
echo "1. Get MongoDB URI from: https://cloud.mongodb.com/"
echo "2. Get Google Client Secret from: https://console.cloud.google.com/"
echo "3. Update .env file with both values"
echo "4. Run: railway variables set MONGODB_URI=... GOOGLE_CLIENT_SECRET=..."
echo "5. Deploy: railway up"
echo "=============================="
