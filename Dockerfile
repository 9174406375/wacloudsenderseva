FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production --ignore-scripts
COPY . .
RUN mkdir -p uploads wwebjs_auth logs
EXPOSE 5000
CMD ["node", "server.js"]
