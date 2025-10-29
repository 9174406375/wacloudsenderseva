#!/bin/bash

echo "🚀 Starting WA Cloud Sender Seva Development Server"
echo ""

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "📦 Starting local MongoDB..."
    mkdir -p ~/mongodb-data
    mongod --dbpath ~/mongodb-data --port 27017 --fork --logpath ~/mongodb-data/mongodb.log
    sleep 2
    echo "✅ MongoDB started"
else
    echo "✅ MongoDB already running"
fi

# Update .env to use local MongoDB
sed -i 's|MONGODB_URI=.*|MONGODB_URI=mongodb://127.0.0.1:27017/wacloudsender|g' .env

echo ""
echo "🌐 Starting Node.js server..."
node server.js
