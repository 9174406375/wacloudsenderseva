#!/bin/bash

echo "🧪 QUICK API TEST"
echo "═══════════════════════════════════════════════════════════"

# Test 1: Health check
echo "1️⃣ Testing /health endpoint..."
curl -s http://localhost:3000/health | jq '.' || curl -s http://localhost:3000/health
echo ""
echo ""

# Test 2: API info
echo "2️⃣ Testing /api endpoint..."
curl -s http://localhost:3000/api | jq '.' || curl -s http://localhost:3000/api
echo ""
echo ""

# Test 3: Auth routes
echo "3️⃣ Testing /api/auth endpoint..."
curl -s http://localhost:3000/api/auth | jq '.' || curl -s http://localhost:3000/api/auth
echo ""
echo ""

# Test 4: Root path
echo "4️⃣ Testing / (root) endpoint..."
curl -s -I http://localhost:3000/ | head -5
echo ""

echo "═══════════════════════════════════════════════════════════"
