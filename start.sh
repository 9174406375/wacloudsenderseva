#!/bin/sh
echo "🚀 Starting WA Cloud Sender Seva..."
echo "📊 Environment: $NODE_ENV"
echo "🔗 Port: ${PORT:-5000}"
exec node server.js
