#!/bin/bash

echo "═══════════════════════════════════════════════════════════"
echo "🔧 MongoDB Connection Fix - WA Cloud Sender Seva"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check current .env
echo "📄 Current MongoDB Configuration:"
grep MONGODB_URI .env
echo ""

echo "Choose MongoDB Setup:"
echo "1) Use MongoDB Atlas (Cloud - needs IP whitelist)"
echo "2) Install Local MongoDB in Termux (Recommended)"
echo "3) Use Free MongoDB Docker (Alternative)"
echo ""
read -p "Enter choice (1/2/3): " choice

case $choice in
    1)
        echo ""
        echo "🌐 MongoDB Atlas Setup Instructions:"
        echo "───────────────────────────────────────────────────"
        echo "1. Go to: https://cloud.mongodb.com"
        echo "2. Login to your account"
        echo "3. Select cluster: ac-gaqf8zn-shard"
        echo "4. Click 'Network Access' → 'Add IP Address'"
        echo "5. Select 'Allow Access from Anywhere' (0.0.0.0/0)"
        echo "6. Click 'Confirm' and wait 2-3 minutes"
        echo ""
        echo "Current Atlas URI detected in .env"
        echo "After whitelist update, restart: node server.js"
        ;;
    
    2)
        echo ""
        echo "📦 Installing Local MongoDB..."
        
        # Install MongoDB
        pkg install mongodb -y
        
        # Create data directory
        mkdir -p ~/mongodb-data
        
        # Start MongoDB
        echo "🚀 Starting MongoDB..."
        mongod --dbpath ~/mongodb-data --port 27017 --fork --logpath ~/mongodb-data/mongodb.log
        
        # Update .env
        echo "📝 Updating .env file..."
        sed -i 's|MONGODB_URI=.*|MONGODB_URI=mongodb://127.0.0.1:27017/wacloudsender|g' .env
        
        echo "✅ Local MongoDB setup complete!"
        echo "MongoDB is running on: mongodb://127.0.0.1:27017"
        echo ""
        echo "To check MongoDB status: ps aux | grep mongod"
        echo "To stop MongoDB: killall mongod"
        ;;
    
    3)
        echo ""
        echo "🐳 Using Alternative Free MongoDB..."
        echo "Update your .env with one of these free alternatives:"
        echo ""
        echo "Option A - MongoDB Atlas Free Tier:"
        echo "MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname"
        echo ""
        echo "Option B - Local Termux:"
        echo "MONGODB_URI=mongodb://127.0.0.1:27017/wacloudsender"
        ;;
    
    *)
        echo "Invalid choice!"
        ;;
esac

echo ""
echo "═══════════════════════════════════════════════════════════"
