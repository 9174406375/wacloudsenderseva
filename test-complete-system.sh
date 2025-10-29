#!/bin/bash

echo "🧪 Testing WA Cloud Sender System..."
echo ""

# Test local server
echo "1️⃣ Local Server Test:"
curl -s http://localhost:5000/health | head -3
echo ""

# Test API info
echo "2️⃣ API Info:"
curl -s http://localhost:5000/ | grep -o '"version":"[^"]*"'
echo ""

# Test MongoDB
echo "3️⃣ MongoDB Connection:"
node -e "require('dotenv').config(); const m=require('mongoose'); m.connect(process.env.MONGODB_URI).then(()=>console.log('✅ Connected to:', m.connection.name)).catch(e=>console.log('❌',e.message)); setTimeout(()=>process.exit(0),2000)"

# Test routes
echo ""
echo "4️⃣ Testing Routes:"
for route in /api/auth /api/contacts /api/campaigns /api/orders /api/analytics /api/admin; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000$route)
    echo "   $route - HTTP $STATUS"
done

echo ""
echo "✅ All tests complete!"
