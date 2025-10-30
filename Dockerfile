FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production --ignore-scripts && npm cache clean --force

# Copy application
COPY . .

# Create directories
RUN mkdir -p uploads wwebjs_auth logs && chmod -R 755 uploads wwebjs_auth logs

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

CMD ["node", "server.js"]
