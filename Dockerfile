FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production --ignore-scripts && npm cache clean --force
COPY . .
RUN mkdir -p uploads wwebjs_auth logs
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 && chown -R nodejs:nodejs /app
USER nodejs
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1
CMD ["node", "server.js"]
