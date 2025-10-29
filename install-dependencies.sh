#!/bin/bash

echo "📦 Installing all dependencies..."

npm install --save \
  express \
  mongoose \
  bcryptjs \
  jsonwebtoken \
  dotenv \
  cors \
  helmet \
  morgan \
  compression \
  socket.io \
  express-rate-limit \
  multer \
  xlsx \
  crypto

echo "✅ All dependencies installed!"
